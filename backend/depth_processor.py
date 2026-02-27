"""LiDAR depth map processing.

Handles raw float32 depth buffers from iPhone ARKit:
- Loads 256x192 depth maps
- Applies camera intrinsics to create 3D point clouds
- Aligns depth points with SMPL mesh for scale estimation
- Computes scale factor from depth measurements
"""

from __future__ import annotations

import logging
from typing import Optional

import numpy as np

from models import DepthData

logger = logging.getLogger(__name__)

# iPhone LiDAR depth map dimensions
DEPTH_WIDTH = 256
DEPTH_HEIGHT = 192


def load_depth_map(
    raw_bytes: bytes,
    width: int = DEPTH_WIDTH,
    height: int = DEPTH_HEIGHT,
) -> np.ndarray:
    """Load a raw float32 depth buffer into a numpy array.

    Args:
        raw_bytes: Raw binary data (float32, row-major).
        width: Depth map width (default 256 for iPhone LiDAR).
        height: Depth map height (default 192 for iPhone LiDAR).

    Returns:
        (height, width) float32 array of depth values in meters.
    """
    expected_size = width * height * 4  # 4 bytes per float32
    if len(raw_bytes) != expected_size:
        raise ValueError(
            f"Depth buffer size mismatch: expected {expected_size} bytes, "
            f"got {len(raw_bytes)}"
        )

    depth_map = np.frombuffer(raw_bytes, dtype=np.float32).reshape(height, width)

    # Filter invalid depth values
    depth_map = np.where(depth_map > 0, depth_map, np.nan)
    depth_map = np.where(depth_map < 10.0, depth_map, np.nan)  # Cap at 10m

    return depth_map


def depth_to_point_cloud(
    depth_map: np.ndarray,
    fx: float,
    fy: float,
    cx: float,
    cy: float,
) -> np.ndarray:
    """Convert depth map to 3D point cloud using camera intrinsics.

    Uses the pinhole camera model:
        X = (u - cx) * Z / fx
        Y = (v - cy) * Z / fy
        Z = depth[v, u]

    Args:
        depth_map: (H, W) float32 depth values in meters.
        fx, fy: Focal lengths in pixels.
        cx, cy: Principal point in pixels.

    Returns:
        (N, 3) array of valid 3D points in camera coordinate frame.
    """
    h, w = depth_map.shape
    u, v = np.meshgrid(np.arange(w), np.arange(h))

    # Mask out invalid depth
    valid = ~np.isnan(depth_map) & (depth_map > 0)

    z = depth_map[valid]
    x = (u[valid] - cx) * z / fx
    y = (v[valid] - cy) * z / fy

    points = np.stack([x, y, z], axis=-1).astype(np.float32)
    return points


def estimate_scale_from_depth(
    point_cloud: np.ndarray,
    known_height_m: float,
) -> float:
    """Estimate metric scale factor from a LiDAR point cloud.

    Computes the vertical extent of the person in the point cloud
    and compares to known height.

    Args:
        point_cloud: (N, 3) array of 3D points.
        known_height_m: Known subject height in meters.

    Returns:
        Scale factor (multiply SMPL mesh by this to get real-world scale).
    """
    if len(point_cloud) < 10:
        logger.warning("Too few depth points for scale estimation")
        return 1.0

    # Use Y-axis extent as proxy for body height
    # (ARKit: Y is up in camera coordinates)
    y_min = np.percentile(point_cloud[:, 1], 2)   # 2nd percentile (feet)
    y_max = np.percentile(point_cloud[:, 1], 98)  # 98th percentile (head)
    observed_height = abs(y_max - y_min)

    if observed_height < 0.1:  # Less than 10cm — invalid
        logger.warning(f"Observed height too small: {observed_height:.3f}m")
        return 1.0

    scale = known_height_m / observed_height
    logger.info(
        f"Depth scale: observed={observed_height:.3f}m, "
        f"known={known_height_m:.3f}m, scale={scale:.4f}"
    )
    return scale


def process_depth(
    raw_bytes: bytes,
    intrinsics: dict,
    known_height_m: float,
    width: int = DEPTH_WIDTH,
    height: int = DEPTH_HEIGHT,
) -> DepthData:
    """Full depth processing pipeline.

    Args:
        raw_bytes: Raw float32 depth buffer from LiDAR.
        intrinsics: Camera intrinsics dict with keys: fx, fy, cx, cy.
        known_height_m: Known subject height in meters.
        width: Depth map width.
        height: Depth map height.

    Returns:
        DepthData with depth map, point cloud, intrinsics matrix, and scale.
    """
    fx = intrinsics.get("fx", 200.0)
    fy = intrinsics.get("fy", 200.0)
    cx = intrinsics.get("cx", width / 2.0)
    cy = intrinsics.get("cy", height / 2.0)

    depth_map = load_depth_map(raw_bytes, width, height)
    point_cloud = depth_to_point_cloud(depth_map, fx, fy, cx, cy)

    intrinsics_matrix = np.array([
        [fx, 0, cx],
        [0, fy, cy],
        [0, 0, 1],
    ], dtype=np.float32)

    scale = estimate_scale_from_depth(point_cloud, known_height_m)

    return DepthData(
        depth_map=depth_map,
        point_cloud=point_cloud,
        intrinsics=intrinsics_matrix,
        scale_factor=scale,
    )
