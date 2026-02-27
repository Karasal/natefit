"""Multi-view SMPL optimization.

Given HMR predictions from front + side views, optimizes for:
- Shared beta (shape) parameters — same body in both views
- Independent theta (pose) parameters — different poses per view
- Optional depth loss when LiDAR data is available

Uses PyTorch autograd for gradient-based optimization.
"""

from __future__ import annotations

import logging
from typing import Optional

import numpy as np
import torch
import torch.nn.functional as F

from models import DepthData, HMRPrediction, OptimizationResult

logger = logging.getLogger(__name__)

# ── Constants ──────────────────────────────────────────────────────────────

MAX_ITERATIONS = 200
LEARNING_RATE = 0.01
CONVERGENCE_THRESHOLD = 1e-6

# Loss weights
W_BETA_PRIOR = 0.01       # Regularize betas toward zero (average body)
W_THETA_PRIOR = 0.001     # Regularize pose toward T-pose
W_BETA_CONSISTENCY = 10.0  # Both views must agree on shape
W_DEPTH = 5.0             # Depth alignment loss (when LiDAR available)
W_CAMERA = 0.1            # Camera parameter regularization


def _axis_angle_to_rotation_matrix(axis_angle: torch.Tensor) -> torch.Tensor:
    """Convert axis-angle representation to rotation matrix using Rodrigues formula.

    Args:
        axis_angle: (N, 3) axis-angle vectors.

    Returns:
        (N, 3, 3) rotation matrices.
    """
    angle = torch.norm(axis_angle, dim=-1, keepdim=True).clamp(min=1e-8)
    axis = axis_angle / angle

    cos_a = torch.cos(angle).unsqueeze(-1)
    sin_a = torch.sin(angle).unsqueeze(-1)

    # Skew-symmetric matrix
    x, y, z = axis[..., 0:1], axis[..., 1:2], axis[..., 2:3]
    zeros = torch.zeros_like(x)

    K = torch.cat([
        torch.cat([zeros, -z, y], dim=-1).unsqueeze(-2),
        torch.cat([z, zeros, -x], dim=-1).unsqueeze(-2),
        torch.cat([-y, x, zeros], dim=-1).unsqueeze(-2),
    ], dim=-2)

    eye = torch.eye(3, device=axis_angle.device).unsqueeze(0).expand(axis_angle.shape[0], -1, -1)
    R = eye + sin_a * K + (1 - cos_a) * torch.bmm(K, K)

    return R


class MultiViewOptimizer:
    """Optimizes SMPL parameters from multi-view HMR predictions."""

    def __init__(self, device: Optional[str] = None):
        if device is None:
            self.device = "cuda" if torch.cuda.is_available() else "cpu"
        else:
            self.device = device

    def optimize(
        self,
        front_pred: HMRPrediction,
        side_pred: HMRPrediction,
        depth_front: Optional[DepthData] = None,
        depth_side: Optional[DepthData] = None,
    ) -> OptimizationResult:
        """Run multi-view optimization.

        Optimizes a shared set of shape (beta) parameters that best explain
        both the front and side view, while allowing independent pose (theta)
        for each view.

        Args:
            front_pred: HMR prediction from front image.
            side_pred: HMR prediction from side image.
            depth_front: Optional LiDAR depth data for front view.
            depth_side: Optional LiDAR depth data for side view.

        Returns:
            OptimizationResult with optimized parameters.
        """
        logger.info("Starting multi-view SMPL optimization")

        # Initialize from HMR predictions (average betas as starting point)
        init_betas = (front_pred.betas + side_pred.betas) / 2.0

        # Optimization variables
        betas = torch.tensor(
            init_betas, dtype=torch.float32, device=self.device, requires_grad=True
        )
        theta_front = torch.tensor(
            front_pred.thetas, dtype=torch.float32, device=self.device, requires_grad=True
        )
        theta_side = torch.tensor(
            side_pred.thetas, dtype=torch.float32, device=self.device, requires_grad=True
        )

        # Original HMR predictions as targets
        target_betas_front = torch.tensor(
            front_pred.betas, dtype=torch.float32, device=self.device
        )
        target_betas_side = torch.tensor(
            side_pred.betas, dtype=torch.float32, device=self.device
        )
        target_theta_front = torch.tensor(
            front_pred.thetas, dtype=torch.float32, device=self.device
        )
        target_theta_side = torch.tensor(
            side_pred.thetas, dtype=torch.float32, device=self.device
        )

        optimizer = torch.optim.Adam(
            [betas, theta_front, theta_side],
            lr=LEARNING_RATE,
        )
        scheduler = torch.optim.lr_scheduler.StepLR(optimizer, step_size=80, gamma=0.5)

        has_depth = depth_front is not None or depth_side is not None
        prev_loss = float("inf")

        for iteration in range(MAX_ITERATIONS):
            optimizer.zero_grad()

            # ── Data term: betas should match both HMR predictions ─────
            loss_data_front = F.mse_loss(betas, target_betas_front)
            loss_data_side = F.mse_loss(betas, target_betas_side)
            loss_data = (loss_data_front + loss_data_side) / 2.0

            # ── Pose data term: thetas should stay near HMR predictions ─
            loss_pose_front = F.mse_loss(theta_front, target_theta_front)
            loss_pose_side = F.mse_loss(theta_side, target_theta_side)
            loss_pose = (loss_pose_front + loss_pose_side) / 2.0

            # ── Beta prior: prefer average body shape ──────────────────
            loss_beta_prior = torch.sum(betas ** 2)

            # ── Theta prior: prefer T-pose (zeros) ────────────────────
            loss_theta_prior = (
                torch.sum(theta_front ** 2) + torch.sum(theta_side ** 2)
            ) / 2.0

            # ── Depth loss (when LiDAR available) ─────────────────────
            loss_depth = torch.tensor(0.0, device=self.device)
            if has_depth:
                loss_depth = self._compute_depth_loss(
                    betas, theta_front, theta_side, depth_front, depth_side
                )

            # ── Total loss ────────────────────────────────────────────
            total_loss = (
                W_BETA_CONSISTENCY * loss_data
                + loss_pose
                + W_BETA_PRIOR * loss_beta_prior
                + W_THETA_PRIOR * loss_theta_prior
                + W_DEPTH * loss_depth
            )

            total_loss.backward()
            optimizer.step()
            scheduler.step()

            current_loss = total_loss.item()

            # Convergence check
            if abs(prev_loss - current_loss) < CONVERGENCE_THRESHOLD:
                logger.info(f"Converged at iteration {iteration}, loss={current_loss:.6f}")
                break
            prev_loss = current_loss

            if iteration % 50 == 0:
                logger.debug(
                    f"Iter {iteration}: total={current_loss:.4f} "
                    f"data={loss_data.item():.4f} "
                    f"beta_prior={loss_beta_prior.item():.4f} "
                    f"depth={loss_depth.item():.4f}"
                )

        # Compute scale from depth if available
        scale = 1.0
        if depth_front is not None:
            scale = depth_front.scale_factor
        elif depth_side is not None:
            scale = depth_side.scale_factor

        result = OptimizationResult(
            betas=betas.detach().cpu().numpy(),
            theta_front=theta_front.detach().cpu().numpy(),
            theta_side=theta_side.detach().cpu().numpy(),
            scale=scale,
            loss=prev_loss,
        )

        logger.info(
            f"Optimization complete: loss={prev_loss:.6f}, "
            f"scale={scale:.4f}, has_depth={has_depth}"
        )
        return result

    def _compute_depth_loss(
        self,
        betas: torch.Tensor,
        theta_front: torch.Tensor,
        theta_side: torch.Tensor,
        depth_front: Optional[DepthData],
        depth_side: Optional[DepthData],
    ) -> torch.Tensor:
        """Compute depth alignment loss between SMPL mesh and LiDAR point cloud.

        Projects SMPL vertices into depth camera space and penalizes disagreement
        with measured depth values.

        In full implementation, this would:
        1. Forward-kinematic SMPL with current betas/thetas to get 3D vertices
        2. Project vertices into the depth camera coordinate frame
        3. Compare vertex depth with measured LiDAR depth at corresponding pixels

        For now, uses a simplified proxy based on beta/theta magnitude
        scaled by the depth data reliability.
        """
        loss = torch.tensor(0.0, device=self.device)

        if depth_front is not None:
            # Proxy: penalize betas that would produce a body size
            # inconsistent with the depth-observed scale
            depth_scale = torch.tensor(
                depth_front.scale_factor, dtype=torch.float32, device=self.device
            )
            # SMPL body "size" proxy from first 3 betas (height, weight, build)
            body_size_proxy = torch.sum(betas[:3] ** 2)
            loss = loss + F.mse_loss(
                body_size_proxy, depth_scale * torch.ones_like(body_size_proxy)
            )

        if depth_side is not None:
            depth_scale = torch.tensor(
                depth_side.scale_factor, dtype=torch.float32, device=self.device
            )
            body_size_proxy = torch.sum(betas[:3] ** 2)
            loss = loss + F.mse_loss(
                body_size_proxy, depth_scale * torch.ones_like(body_size_proxy)
            )

        return loss
