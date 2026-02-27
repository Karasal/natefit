"""Body composition estimation from SMPL parameters.

Two approaches:
1. MLP model: Input = 10 SMPL betas + height + weight + age + sex → body fat%, lean mass, fat mass
2. Fallback: Navy + CUN-BAE ensemble formulas (same as frontend TypeScript version)

The MLP is trained on paired SMPL-DEXA data. When confidence is low
or no pretrained weights are available, falls back to formula-based estimation.
"""

from __future__ import annotations

import logging
import math
from pathlib import Path
from typing import Optional

import numpy as np
import torch
import torch.nn as nn

from models import BodyCompositionResult, MeasurementSet

logger = logging.getLogger(__name__)

# ── MLP Architecture ──────────────────────────────────────────────────────

class BodyCompositionMLP(nn.Module):
    """MLP that predicts body composition from SMPL shape + demographics.

    Input features (14):
        - 10 SMPL beta parameters (body shape encoding)
        - height_cm (normalized)
        - weight_kg (normalized)
        - age (normalized)
        - sex (0 = male, 1 = female)

    Output (3):
        - body_fat_pct (0-60%)
        - lean_mass_kg
        - fat_mass_kg
    """

    def __init__(self):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(14, 64),
            nn.ReLU(inplace=True),
            nn.BatchNorm1d(64),
            nn.Dropout(0.1),
            nn.Linear(64, 32),
            nn.ReLU(inplace=True),
            nn.BatchNorm1d(32),
            nn.Dropout(0.1),
            nn.Linear(32, 3),
        )

        # Output activation: sigmoid for body_fat_pct, softplus for masses
        self._initialize_weights()

    def _initialize_weights(self) -> None:
        """Initialize weights for reasonable outputs before training."""
        for m in self.modules():
            if isinstance(m, nn.Linear):
                nn.init.kaiming_normal_(m.weight, nonlinearity="relu")
                if m.bias is not None:
                    nn.init.zeros_(m.bias)
            elif isinstance(m, nn.BatchNorm1d):
                nn.init.ones_(m.weight)
                nn.init.zeros_(m.bias)

        # Set final layer bias for typical body composition
        # body_fat_pct ~20%, lean_mass ~60kg, fat_mass ~15kg
        with torch.no_grad():
            self.net[-1].bias.copy_(torch.tensor([20.0, 60.0, 15.0]))

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """
        Args:
            x: (B, 14) input features

        Returns:
            (B, 3) — [body_fat_pct, lean_mass_kg, fat_mass_kg]
        """
        out = self.net(x)
        # Ensure physically valid outputs
        body_fat = torch.sigmoid(out[:, 0:1]) * 60.0  # 0-60%
        lean_mass = torch.nn.functional.softplus(out[:, 1:2])
        fat_mass = torch.nn.functional.softplus(out[:, 2:3])
        return torch.cat([body_fat, lean_mass, fat_mass], dim=1)


# ── Formula-based fallbacks (mirrors frontend TypeScript) ─────────────────

def navy_body_fat(
    sex: str,
    waist_cm: float,
    neck_cm: float,
    hip_cm: float,
    height_cm: float,
) -> float:
    """U.S. Navy body fat formula.

    Male:   %BF = 86.010 * log10(waist - neck) - 70.041 * log10(height) + 36.76
    Female: %BF = 163.205 * log10(waist + hip - neck) - 97.684 * log10(height) - 78.387
    """
    if sex == "male":
        diff = waist_cm - neck_cm
        if diff <= 0:
            return 5.0
        return 86.010 * math.log10(diff) - 70.041 * math.log10(height_cm) + 36.76
    else:
        total = waist_cm + hip_cm - neck_cm
        if total <= 0:
            return 10.0
        return 163.205 * math.log10(total) - 97.684 * math.log10(height_cm) - 78.387


def cunbae_body_fat(bmi: float, age: int, sex: str) -> float:
    """CUN-BAE formula (Clinica Universidad de Navarra - Body Adiposity Estimator).

    BF% = -44.988 + (0.503 * age) + (10.689 * s) + (3.172 * BMI)
          - (0.026 * BMI^2) + (0.181 * BMI * s) - (0.02 * BMI * age)
          - (0.005 * BMI^2 * s) + (0.00021 * BMI^2 * age)

    Where s = 1 for female, 0 for male.
    """
    s = 1.0 if sex == "female" else 0.0
    return (
        -44.988
        + 0.503 * age
        + 10.689 * s
        + 3.172 * bmi
        - 0.026 * bmi * bmi
        + 0.181 * bmi * s
        - 0.02 * bmi * age
        - 0.005 * bmi * bmi * s
        + 0.00021 * bmi * bmi * age
    )


def formula_body_composition(
    sex: str,
    age: int,
    height_cm: float,
    weight_kg: float,
    measurements: MeasurementSet,
) -> BodyCompositionResult:
    """Body composition via Navy + CUN-BAE ensemble (60/40 split).

    Mirrors the frontend TypeScript implementation exactly.
    """
    bmi = weight_kg / ((height_cm / 100.0) ** 2)

    waist = measurements.waist if measurements.waist > 0 else 80.0
    neck = measurements.neck if measurements.neck > 0 else 38.0
    hips = measurements.hips if measurements.hips > 0 else 95.0

    navy = navy_body_fat(sex, waist, neck, hips, height_cm)
    cunbae = cunbae_body_fat(bmi, age, sex)

    navy_clamped = max(3.0, min(60.0, navy))
    cunbae_clamped = max(3.0, min(60.0, cunbae))

    body_fat_pct = navy_clamped * 0.6 + cunbae_clamped * 0.4
    fat_mass_kg = (body_fat_pct / 100.0) * weight_kg
    lean_mass_kg = weight_kg - fat_mass_kg
    waist_hip_ratio = waist / hips if hips > 0 else 0.0

    return BodyCompositionResult(
        body_fat_pct=body_fat_pct,
        lean_mass_kg=lean_mass_kg,
        fat_mass_kg=fat_mass_kg,
        bmi=bmi,
        body_fat_navy=navy_clamped,
        body_fat_cunbae=cunbae_clamped,
        waist_hip_ratio=waist_hip_ratio,
        method="ensemble",
    )


# ── Main estimator class ─────────────────────────────────────────────────

class BodyCompositionEstimator:
    """Estimates body composition using MLP with formula fallback."""

    def __init__(
        self,
        weights_path: Optional[str] = None,
        device: Optional[str] = None,
    ):
        """
        Args:
            weights_path: Path to pretrained MLP weights (.pt file).
                         If None or file doesn't exist, falls back to formulas.
            device: Torch device. Auto-detects GPU if None.
        """
        if device is None:
            self.device = "cuda" if torch.cuda.is_available() else "cpu"
        else:
            self.device = device

        self.mlp: Optional[BodyCompositionMLP] = None
        self.has_pretrained = False

        if weights_path and Path(weights_path).exists():
            try:
                self.mlp = BodyCompositionMLP()
                state = torch.load(weights_path, map_location="cpu", weights_only=True)
                self.mlp.load_state_dict(state)
                self.mlp.to(self.device)
                self.mlp.eval()
                self.has_pretrained = True
                logger.info(f"Loaded body composition MLP from {weights_path}")
            except Exception as e:
                logger.warning(f"Failed to load MLP weights: {e}")
                self.mlp = None
        else:
            # Initialize with random weights for development
            self.mlp = BodyCompositionMLP()
            self.mlp.to(self.device)
            self.mlp.eval()
            logger.info("Body composition MLP initialized (no pretrained weights)")

    def estimate(
        self,
        betas: np.ndarray,
        height_cm: float,
        weight_kg: float,
        age: int,
        sex: str,
        measurements: MeasurementSet,
    ) -> BodyCompositionResult:
        """Estimate body composition.

        Uses MLP if pretrained weights are available and confidence is high.
        Falls back to Navy + CUN-BAE ensemble otherwise.

        Args:
            betas: (10,) SMPL shape parameters.
            height_cm: Subject height in cm.
            weight_kg: Subject weight in kg.
            age: Subject age in years.
            sex: "male" or "female".
            measurements: Extracted body measurements (for formula fallback).

        Returns:
            BodyCompositionResult.
        """
        # Always compute formula-based estimate as baseline/fallback
        formula_result = formula_body_composition(
            sex, age, height_cm, weight_kg, measurements
        )

        # Try MLP prediction
        if self.mlp is not None and self.has_pretrained:
            try:
                mlp_result = self._predict_mlp(betas, height_cm, weight_kg, age, sex)

                # Validate MLP output against formula (sanity check)
                bf_diff = abs(mlp_result.body_fat_pct - formula_result.body_fat_pct)
                if bf_diff < 10.0:
                    # MLP and formula roughly agree — trust MLP
                    logger.info(
                        f"Using MLP prediction: bf={mlp_result.body_fat_pct:.1f}% "
                        f"(formula={formula_result.body_fat_pct:.1f}%)"
                    )
                    return mlp_result
                else:
                    # Large disagreement — use formula as safer option
                    logger.warning(
                        f"MLP/formula disagreement ({bf_diff:.1f}%), "
                        f"falling back to formula"
                    )
                    return formula_result

            except Exception as e:
                logger.warning(f"MLP prediction failed: {e}, using formula fallback")
                return formula_result

        return formula_result

    @torch.no_grad()
    def _predict_mlp(
        self,
        betas: np.ndarray,
        height_cm: float,
        weight_kg: float,
        age: int,
        sex: str,
    ) -> BodyCompositionResult:
        """Run MLP inference.

        Input normalization:
            - betas: already in SMPL units (roughly N(0,1))
            - height_cm: divide by 180 (approximate mean)
            - weight_kg: divide by 80
            - age: divide by 50
            - sex: 0 = male, 1 = female
        """
        sex_val = 1.0 if sex == "female" else 0.0

        features = np.concatenate([
            betas.astype(np.float32),
            np.array([
                height_cm / 180.0,
                weight_kg / 80.0,
                age / 50.0,
                sex_val,
            ], dtype=np.float32),
        ])

        input_tensor = torch.tensor(features, dtype=torch.float32).unsqueeze(0).to(self.device)
        output = self.mlp(input_tensor)[0]

        body_fat_pct = output[0].item()
        lean_mass_kg = output[1].item()
        fat_mass_kg = output[2].item()

        # Ensure physical consistency: fat + lean = total weight
        total_predicted = lean_mass_kg + fat_mass_kg
        if total_predicted > 0:
            lean_mass_kg = lean_mass_kg * (weight_kg / total_predicted)
            fat_mass_kg = fat_mass_kg * (weight_kg / total_predicted)

        bmi = weight_kg / ((height_cm / 100.0) ** 2)

        return BodyCompositionResult(
            body_fat_pct=body_fat_pct,
            lean_mass_kg=lean_mass_kg,
            fat_mass_kg=fat_mass_kg,
            bmi=bmi,
            body_fat_navy=0.0,  # Not computed via MLP path
            body_fat_cunbae=0.0,
            waist_hip_ratio=0.0,
            method="mlp",
        )
