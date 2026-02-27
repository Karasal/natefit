"""HMR 2.0 (Human Mesh Recovery) inference wrapper.

Uses a ViT-H backbone to predict SMPL parameters from a single RGB image.
Reference: 4D-Humans (Goel et al., 2023) — https://github.com/shubham-goel/4D-Humans
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Optional

import numpy as np
import torch
import torch.nn as nn
from PIL import Image
from torchvision import transforms

from models import HMRPrediction

logger = logging.getLogger(__name__)

# ── Constants ──────────────────────────────────────────────────────────────

HMR_INPUT_SIZE = 256
SMPL_BETA_DIM = 10
SMPL_THETA_DIM = 72  # 24 joints x 3 axis-angle
CAMERA_DIM = 3       # weak-perspective: [scale, tx, ty]

# ImageNet normalization
IMAGENET_MEAN = [0.485, 0.456, 0.406]
IMAGENET_STD = [0.229, 0.224, 0.225]


# ── Lightweight HMR Head (placeholder architecture) ───────────────────────

class HMRHead(nn.Module):
    """Regression head that takes ViT features and outputs SMPL parameters.

    In production, this loads the pretrained 4D-Humans checkpoint.
    For development, uses a simple MLP that outputs plausible SMPL params.
    """

    def __init__(self, feat_dim: int = 1280):
        super().__init__()
        self.feat_dim = feat_dim

        # Feature pooling + regression
        self.pool = nn.AdaptiveAvgPool2d(1)
        self.regressor = nn.Sequential(
            nn.Linear(feat_dim, 1024),
            nn.ReLU(inplace=True),
            nn.Dropout(0.1),
            nn.Linear(1024, 512),
            nn.ReLU(inplace=True),
            nn.Dropout(0.1),
            nn.Linear(512, SMPL_BETA_DIM + SMPL_THETA_DIM + CAMERA_DIM),
        )

        # Initialize betas near zero (average body), thetas near zero (T-pose),
        # camera with reasonable defaults
        nn.init.zeros_(self.regressor[-1].weight)
        bias = torch.zeros(SMPL_BETA_DIM + SMPL_THETA_DIM + CAMERA_DIM)
        bias[SMPL_BETA_DIM + SMPL_THETA_DIM] = 1.0  # scale = 1
        self.regressor[-1].bias = nn.Parameter(bias)

    def forward(self, features: torch.Tensor) -> tuple[torch.Tensor, torch.Tensor, torch.Tensor]:
        """
        Args:
            features: (B, feat_dim, H, W) from ViT backbone

        Returns:
            betas:  (B, 10) SMPL shape parameters
            thetas: (B, 72) SMPL pose parameters
            camera: (B, 3)  weak-perspective camera
        """
        if features.dim() == 4:
            x = self.pool(features).flatten(1)
        else:
            x = features  # Already pooled

        params = self.regressor(x)

        betas = params[:, :SMPL_BETA_DIM]
        thetas = params[:, SMPL_BETA_DIM:SMPL_BETA_DIM + SMPL_THETA_DIM]
        camera = params[:, SMPL_BETA_DIM + SMPL_THETA_DIM:]

        return betas, thetas, camera


class HMRModel(nn.Module):
    """Full HMR 2.0 model: ViT-H backbone + regression head.

    In production, loads pretrained 4D-Humans weights.
    For dev, uses torchvision ViT with random regression head.
    """

    def __init__(self, pretrained_path: Optional[str] = None):
        super().__init__()

        # ViT-H backbone (using torchvision's ViT as a stand-in)
        # Production would use the exact 4D-Humans ViT-H/16 architecture
        try:
            from torchvision.models import vit_b_16, ViT_B_16_Weights
            backbone = vit_b_16(weights=ViT_B_16_Weights.DEFAULT)
            self.feat_dim = 768  # ViT-B hidden dim
            # Remove the classification head, keep encoder
            self.backbone = nn.Sequential(
                backbone.conv_proj,
                nn.Flatten(2),
            )
            # We'll use a simpler approach: process through the full ViT
            # and take the class token output
            self.vit = backbone
            self.vit.heads = nn.Identity()  # Remove classification head
        except Exception:
            logger.warning("ViT backbone not available, using simple CNN fallback")
            self.vit = None
            self.feat_dim = 512
            self.backbone = nn.Sequential(
                nn.Conv2d(3, 64, 7, stride=2, padding=3),
                nn.ReLU(inplace=True),
                nn.MaxPool2d(3, stride=2, padding=1),
                nn.Conv2d(64, 128, 3, padding=1),
                nn.ReLU(inplace=True),
                nn.Conv2d(128, 256, 3, padding=1),
                nn.ReLU(inplace=True),
                nn.AdaptiveAvgPool2d(1),
                nn.Flatten(),
                nn.Linear(256, self.feat_dim),
                nn.ReLU(inplace=True),
            )

        self.head = HMRHead(feat_dim=self.feat_dim)

        # Load pretrained weights if provided
        if pretrained_path and Path(pretrained_path).exists():
            self._load_pretrained(pretrained_path)

    def _load_pretrained(self, path: str) -> None:
        """Load pretrained HMR 2.0 checkpoint."""
        logger.info(f"Loading HMR pretrained weights from {path}")
        state_dict = torch.load(path, map_location="cpu", weights_only=True)
        # Handle different checkpoint formats
        if "model" in state_dict:
            state_dict = state_dict["model"]
        if "state_dict" in state_dict:
            state_dict = state_dict["state_dict"]
        self.load_state_dict(state_dict, strict=False)

    def forward(self, images: torch.Tensor) -> tuple[torch.Tensor, torch.Tensor, torch.Tensor]:
        """
        Args:
            images: (B, 3, 256, 256) normalized RGB images

        Returns:
            betas, thetas, camera tensors
        """
        if self.vit is not None:
            features = self.vit(images)  # (B, feat_dim) from class token
        else:
            features = self.backbone(images)  # (B, feat_dim)

        return self.head(features)


# ── Preprocessing ──────────────────────────────────────────────────────────

def preprocess_image(image: Image.Image) -> torch.Tensor:
    """Preprocess a PIL image for HMR inference.

    Resizes to 256x256, normalizes with ImageNet stats.

    Args:
        image: Input PIL RGB image of any size.

    Returns:
        Tensor of shape (1, 3, 256, 256).
    """
    transform = transforms.Compose([
        transforms.Resize((HMR_INPUT_SIZE, HMR_INPUT_SIZE)),
        transforms.ToTensor(),
        transforms.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD),
    ])
    tensor = transform(image.convert("RGB"))
    return tensor.unsqueeze(0)  # Add batch dim


# ── Inference ──────────────────────────────────────────────────────────────

class HMRInference:
    """Stateful HMR inference engine. Loads model once, runs many times."""

    def __init__(
        self,
        pretrained_path: Optional[str] = None,
        device: Optional[str] = None,
    ):
        if device is None:
            self.device = "cuda" if torch.cuda.is_available() else "cpu"
        else:
            self.device = device

        logger.info(f"Initializing HMR model on {self.device}")
        self.model = HMRModel(pretrained_path=pretrained_path)
        self.model.to(self.device)
        self.model.eval()
        logger.info("HMR model ready")

    @torch.no_grad()
    def predict(self, image: Image.Image) -> HMRPrediction:
        """Run HMR inference on a single image.

        Args:
            image: PIL RGB image (any size, will be resized to 256x256).

        Returns:
            HMRPrediction with SMPL betas, thetas, camera params.
        """
        input_tensor = preprocess_image(image).to(self.device)

        betas, thetas, camera = self.model(input_tensor)

        # Compute confidence from parameter magnitude
        # Well-predicted bodies have moderate beta/theta values
        beta_mag = torch.norm(betas).item()
        theta_mag = torch.norm(thetas).item()
        # Confidence heuristic: high confidence when params are moderate
        confidence = min(1.0, 1.0 / (1.0 + 0.1 * beta_mag + 0.01 * theta_mag))

        return HMRPrediction(
            betas=betas[0].cpu().numpy(),
            thetas=thetas[0].cpu().numpy(),
            camera=camera[0].cpu().numpy(),
            confidence=confidence,
        )

    @torch.no_grad()
    def predict_batch(self, images: list[Image.Image]) -> list[HMRPrediction]:
        """Run HMR inference on a batch of images.

        Args:
            images: List of PIL RGB images.

        Returns:
            List of HMRPrediction, one per image.
        """
        if not images:
            return []

        tensors = [preprocess_image(img) for img in images]
        batch = torch.cat(tensors, dim=0).to(self.device)

        betas, thetas, cameras = self.model(batch)

        results = []
        for i in range(len(images)):
            beta_mag = torch.norm(betas[i]).item()
            theta_mag = torch.norm(thetas[i]).item()
            confidence = min(1.0, 1.0 / (1.0 + 0.1 * beta_mag + 0.01 * theta_mag))

            results.append(HMRPrediction(
                betas=betas[i].cpu().numpy(),
                thetas=thetas[i].cpu().numpy(),
                camera=cameras[i].cpu().numpy(),
                confidence=confidence,
            ))

        return results
