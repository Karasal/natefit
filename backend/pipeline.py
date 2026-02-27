"""Scan processing pipeline.

Orchestrates the full flow:
  1. HMR 2.0 inference on front + side images
  2. Multi-view beta optimization (+ optional depth loss)
  3. Measurement extraction from SMPL mesh
  4. Body composition estimation
  5. Return complete scan result
"""

from __future__ import annotations

import logging
import time
from typing import Optional

import numpy as np
from PIL import Image

from body_composition import BodyCompositionEstimator, formula_body_composition
from depth_processor import process_depth
from hmr_inference import HMRInference
from measurement_extractor import MeasurementExtractor
from models import (
    BodyCompositionResult,
    DepthData,
    MeasurementSet,
    ScanResponse,
    ScanTier,
)
from smpl_optimizer import MultiViewOptimizer

logger = logging.getLogger(__name__)


class ScanPipeline:
    """Full SMPL-based body scan pipeline."""

    def __init__(
        self,
        hmr_weights_path: Optional[str] = None,
        smpl_model_path: Optional[str] = None,
        composition_weights_path: Optional[str] = None,
        device: Optional[str] = None,
    ):
        """Initialize all pipeline components.

        Args:
            hmr_weights_path: Path to pretrained HMR 2.0 weights.
            smpl_model_path: Path to SMPL model .npz file.
            composition_weights_path: Path to body composition MLP weights.
            device: Torch device (auto-detects GPU if None).
        """
        logger.info("Initializing scan pipeline...")
        t0 = time.time()

        self.hmr = HMRInference(
            pretrained_path=hmr_weights_path,
            device=device,
        )
        self.optimizer = MultiViewOptimizer(device=device)
        self.extractor = MeasurementExtractor(smpl_model_path=smpl_model_path)
        self.composition = BodyCompositionEstimator(
            weights_path=composition_weights_path,
            device=device,
        )

        logger.info(f"Pipeline initialized in {time.time() - t0:.2f}s")

    def process(
        self,
        front_image: Image.Image,
        side_image: Image.Image,
        height_cm: float,
        weight_kg: float,
        age: int,
        sex: str,
        depth_front_bytes: Optional[bytes] = None,
        depth_side_bytes: Optional[bytes] = None,
        camera_intrinsics: Optional[dict] = None,
    ) -> ScanResponse:
        """Run the full scan pipeline.

        Args:
            front_image: Front-facing PIL RGB image.
            side_image: Side-profile PIL RGB image.
            height_cm: Subject height in cm.
            weight_kg: Subject weight in kg.
            age: Subject age in years.
            sex: "male" or "female".
            depth_front_bytes: Optional raw LiDAR depth buffer (front view).
            depth_side_bytes: Optional raw LiDAR depth buffer (side view).
            camera_intrinsics: Optional dict with fx, fy, cx, cy.

        Returns:
            ScanResponse with all measurements, body composition, and mesh.
        """
        t0 = time.time()
        has_depth = depth_front_bytes is not None or depth_side_bytes is not None

        logger.info(
            f"Processing scan: {sex}, {age}yo, {height_cm}cm, {weight_kg}kg, "
            f"depth={'yes' if has_depth else 'no'}"
        )

        # ── Step 1: HMR inference ──────────────────────────────────────
        t1 = time.time()
        front_pred = self.hmr.predict(front_image)
        side_pred = self.hmr.predict(side_image)
        logger.info(f"HMR inference: {time.time() - t1:.3f}s")

        # ── Step 2: Process depth data (if available) ──────────────────
        depth_front: Optional[DepthData] = None
        depth_side: Optional[DepthData] = None
        intrinsics = camera_intrinsics or {}

        if depth_front_bytes:
            try:
                depth_front = process_depth(
                    depth_front_bytes, intrinsics, height_cm / 100.0
                )
            except Exception as e:
                logger.warning(f"Front depth processing failed: {e}")

        if depth_side_bytes:
            try:
                depth_side = process_depth(
                    depth_side_bytes, intrinsics, height_cm / 100.0
                )
            except Exception as e:
                logger.warning(f"Side depth processing failed: {e}")

        # ── Step 3: Multi-view optimization ────────────────────────────
        t2 = time.time()
        opt_result = self.optimizer.optimize(
            front_pred, side_pred, depth_front, depth_side
        )
        logger.info(f"Optimization: {time.time() - t2:.3f}s, loss={opt_result.loss:.6f}")

        # ── Step 4: Measurement extraction ─────────────────────────────
        t3 = time.time()
        measurements = self.extractor.extract(opt_result.betas, height_cm)
        vertices, faces = self.extractor.get_mesh(opt_result.betas, height_cm)
        logger.info(f"Measurement extraction: {time.time() - t3:.3f}s")

        # ── Step 5: Body composition ───────────────────────────────────
        t4 = time.time()
        composition = self.composition.estimate(
            opt_result.betas, height_cm, weight_kg, age, sex, measurements
        )
        logger.info(f"Body composition: {time.time() - t4:.3f}s")

        # ── Step 6: Compute confidence ─────────────────────────────────
        confidence = self._compute_confidence(
            front_pred.confidence,
            side_pred.confidence,
            opt_result.loss,
            has_depth,
        )

        # ── Step 7: Build response ─────────────────────────────────────
        scan_tier = ScanTier.lidar if has_depth else ScanTier.photo

        # Convert measurements to circumference results format
        measurements_dict = measurements.to_dict()

        # Build circumferences list for frontend compatibility
        circumferences = []
        circumference_regions = [
            "neck", "chest", "waist", "hips", "shoulders",
            "left_bicep", "right_bicep", "left_forearm", "right_forearm",
            "left_thigh", "right_thigh", "left_calf", "right_calf", "wrist",
        ]
        for region in circumference_regions:
            key = f"{region}_cm"
            value = measurements_dict.get(key, 0.0)
            if value > 0:
                circumferences.append({
                    "region": region,
                    "circumference_cm": value,
                    "frontal_width_cm": 0.0,
                    "sagittal_depth_cm": 0.0,
                    "confidence": confidence,
                })

        response = ScanResponse(
            measurements=measurements_dict,
            body_composition=composition.to_dict(),
            mesh_vertices=vertices.tolist(),
            mesh_faces=faces.tolist(),
            confidence=confidence,
            scan_tier=scan_tier,
        )

        total_time = time.time() - t0
        logger.info(
            f"Scan complete in {total_time:.2f}s — "
            f"tier={scan_tier.value}, confidence={confidence:.2f}"
        )

        return response

    def _compute_confidence(
        self,
        front_confidence: float,
        side_confidence: float,
        optimization_loss: float,
        has_depth: bool,
    ) -> float:
        """Compute overall scan confidence score.

        Combines HMR confidence, optimization loss, and scan tier.
        """
        # Average HMR confidence
        hmr_conf = (front_confidence + side_confidence) / 2.0

        # Optimization quality (lower loss = higher confidence)
        opt_conf = max(0.0, min(1.0, 1.0 / (1.0 + optimization_loss * 10)))

        # Depth bonus
        depth_bonus = 0.1 if has_depth else 0.0

        confidence = 0.5 * hmr_conf + 0.4 * opt_conf + depth_bonus
        return max(0.0, min(1.0, round(confidence, 2)))
