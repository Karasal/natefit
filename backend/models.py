"""Pydantic models for the NATEFIT GPU backend API."""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Optional

import numpy as np
from pydantic import BaseModel, Field


# ── Enums ──────────────────────────────────────────────────────────────────

class Sex(str, Enum):
    male = "male"
    female = "female"


class ScanTier(str, Enum):
    lidar = "lidar"
    photo = "photo"


# ── Internal dataclasses (pipeline internals) ─────────────────────────────

@dataclass
class HMRPrediction:
    """Output of HMR 2.0 inference on a single image."""
    betas: np.ndarray          # (10,) SMPL shape parameters
    thetas: np.ndarray         # (72,) SMPL pose parameters (axis-angle)
    camera: np.ndarray         # (3,)  weak-perspective camera [s, tx, ty]
    confidence: float = 0.0


@dataclass
class OptimizationResult:
    """Output of multi-view SMPL optimization."""
    betas: np.ndarray          # (10,) optimized shared shape
    theta_front: np.ndarray    # (72,) optimized front pose
    theta_side: np.ndarray     # (72,) optimized side pose
    scale: float = 1.0         # depth-derived scale factor (1.0 if no LiDAR)
    loss: float = 0.0


@dataclass
class DepthData:
    """Processed LiDAR depth information."""
    depth_map: np.ndarray      # (H, W) float32 depth in meters
    point_cloud: np.ndarray    # (N, 3) 3D points
    intrinsics: np.ndarray     # (3, 3) camera intrinsic matrix
    scale_factor: float = 1.0


@dataclass
class MeasurementSet:
    """Full set of body measurements extracted from SMPL mesh."""
    # Circumferences (cm)
    neck: float = 0.0
    chest: float = 0.0
    waist: float = 0.0
    hips: float = 0.0
    shoulders: float = 0.0
    left_bicep: float = 0.0
    right_bicep: float = 0.0
    left_forearm: float = 0.0
    right_forearm: float = 0.0
    left_thigh: float = 0.0
    right_thigh: float = 0.0
    left_calf: float = 0.0
    right_calf: float = 0.0
    wrist: float = 0.0
    # Lengths (cm)
    height: float = 0.0
    arm_span: float = 0.0
    shoulder_width: float = 0.0
    torso_length: float = 0.0
    inseam: float = 0.0

    def to_dict(self) -> dict[str, float]:
        return {
            "neck_cm": round(self.neck, 1),
            "chest_cm": round(self.chest, 1),
            "waist_cm": round(self.waist, 1),
            "hips_cm": round(self.hips, 1),
            "shoulders_cm": round(self.shoulders, 1),
            "left_bicep_cm": round(self.left_bicep, 1),
            "right_bicep_cm": round(self.right_bicep, 1),
            "left_forearm_cm": round(self.left_forearm, 1),
            "right_forearm_cm": round(self.right_forearm, 1),
            "left_thigh_cm": round(self.left_thigh, 1),
            "right_thigh_cm": round(self.right_thigh, 1),
            "left_calf_cm": round(self.left_calf, 1),
            "right_calf_cm": round(self.right_calf, 1),
            "wrist_cm": round(self.wrist, 1),
            "height_cm": round(self.height, 1),
            "arm_span_cm": round(self.arm_span, 1),
            "shoulder_width_cm": round(self.shoulder_width, 1),
            "torso_length_cm": round(self.torso_length, 1),
            "inseam_cm": round(self.inseam, 1),
        }


@dataclass
class BodyCompositionResult:
    """Body composition estimates."""
    body_fat_pct: float = 0.0
    lean_mass_kg: float = 0.0
    fat_mass_kg: float = 0.0
    bmi: float = 0.0
    body_fat_navy: float = 0.0
    body_fat_cunbae: float = 0.0
    waist_hip_ratio: float = 0.0
    method: str = "ensemble"  # "mlp", "navy", "cunbae", "ensemble"

    def to_dict(self) -> dict[str, float | str]:
        return {
            "body_fat_pct": round(self.body_fat_pct, 1),
            "lean_mass_kg": round(self.lean_mass_kg, 1),
            "fat_mass_kg": round(self.fat_mass_kg, 1),
            "bmi": round(self.bmi, 1),
            "body_fat_navy": round(self.body_fat_navy, 1),
            "body_fat_cunbae": round(self.body_fat_cunbae, 1),
            "waist_hip_ratio": round(self.waist_hip_ratio, 2),
            "method": self.method,
        }


# ── API request / response models ─────────────────────────────────────────

class ScanMetadata(BaseModel):
    """Metadata sent alongside scan images."""
    height_cm: float = Field(..., gt=50, lt=300, description="Subject height in cm")
    weight_kg: float = Field(..., gt=20, lt=500, description="Subject weight in kg")
    age: int = Field(..., ge=10, le=120, description="Subject age in years")
    sex: Sex
    camera_intrinsics: Optional[list[list[float]]] = Field(
        None, description="3x3 camera intrinsic matrix (for LiDAR depth alignment)"
    )


class ScanResponse(BaseModel):
    """Full scan result returned by the API."""
    measurements: dict[str, float]
    body_composition: dict[str, float | str]
    mesh_vertices: list[list[float]]   # (6890, 3) flattened
    mesh_faces: list[list[int]]        # (13776, 3) flattened
    confidence: float = Field(..., ge=0, le=1)
    scan_tier: ScanTier

    model_config = {"json_schema_extra": {
        "example": {
            "measurements": {"waist_cm": 82.3, "chest_cm": 98.1},
            "body_composition": {"body_fat_pct": 18.2, "lean_mass_kg": 65.1},
            "mesh_vertices": [[0.1, 0.2, 0.3]],
            "mesh_faces": [[0, 1, 2]],
            "confidence": 0.87,
            "scan_tier": "photo",
        }
    }}


class HealthResponse(BaseModel):
    """Health check response."""
    status: str = "ok"
    gpu_available: bool = False
    model_loaded: bool = False
