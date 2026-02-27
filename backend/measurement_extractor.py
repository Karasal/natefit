"""SMPL-Anthropometry: Extract body measurements from SMPL mesh.

Takes optimized SMPL betas, generates a T-pose mesh, defines anatomical
landmark positions, slices the mesh at horizontal planes for each body region,
and calculates circumferences from slice contours.

SMPL mesh has 6890 vertices and 13776 faces.
"""

from __future__ import annotations

import logging
from typing import Optional

import numpy as np
import trimesh

from models import MeasurementSet

logger = logging.getLogger(__name__)

# ── SMPL Vertex Indices for Anatomical Landmarks ──────────────────────────
# These are standard vertex indices on the SMPL topology (6890 vertices)
# that correspond to anatomical landmarks. Sourced from SMPL documentation
# and the SMPL-Anthropometry project.

LANDMARKS = {
    # Head / Neck
    "top_of_head": 411,
    "chin": 3386,
    "neck_front": 3068,
    "neck_back": 829,
    "neck_left": 3165,
    "neck_right": 672,

    # Shoulders
    "left_shoulder": 3010,
    "right_shoulder": 6470,
    "left_shoulder_tip": 3015,
    "right_shoulder_tip": 6475,

    # Chest / Torso
    "sternum": 3076,
    "chest_left": 1325,
    "chest_right": 4742,
    "navel": 3500,
    "left_hip_joint": 1799,
    "right_hip_joint": 5262,
    "crotch": 3149,

    # Waist
    "waist_front": 3504,
    "waist_back": 3021,
    "waist_left": 1325,
    "waist_right": 4742,

    # Hips
    "hip_front": 3145,
    "hip_back": 3117,
    "hip_left": 1812,
    "hip_right": 5275,

    # Left Arm
    "left_bicep_upper": 1308,
    "left_bicep_lower": 1315,
    "left_elbow": 1657,
    "left_forearm": 1943,
    "left_wrist": 2108,
    "left_hand_tip": 2445,

    # Right Arm
    "right_bicep_upper": 4777,
    "right_bicep_lower": 4782,
    "right_elbow": 5121,
    "right_forearm": 5407,
    "right_wrist": 5572,
    "right_hand_tip": 5905,

    # Left Leg
    "left_thigh_upper": 1003,
    "left_thigh_lower": 1012,
    "left_knee": 1058,
    "left_calf": 1112,
    "left_ankle": 3327,
    "left_heel": 3387,
    "left_toe": 3233,

    # Right Leg
    "right_thigh_upper": 4463,
    "right_thigh_lower": 4472,
    "right_knee": 4518,
    "right_calf": 4572,
    "right_ankle": 6787,
    "right_heel": 6847,
    "right_toe": 6693,
}


def _get_smpl_mesh(
    betas: np.ndarray,
    smpl_model_path: Optional[str] = None,
) -> tuple[np.ndarray, np.ndarray]:
    """Generate SMPL mesh in T-pose from shape parameters.

    Args:
        betas: (10,) SMPL shape parameters.
        smpl_model_path: Path to SMPL model .npz file. If None, generates
                        a synthetic placeholder mesh for development.

    Returns:
        vertices: (6890, 3) mesh vertices in meters.
        faces: (13776, 3) mesh face indices.
    """
    if smpl_model_path is not None:
        try:
            import smplx
            model = smplx.create(
                smpl_model_path,
                model_type="smpl",
                gender="neutral",
                num_betas=10,
            )
            import torch
            betas_tensor = torch.tensor(betas, dtype=torch.float32).unsqueeze(0)
            output = model(betas=betas_tensor)
            vertices = output.vertices.detach().cpu().numpy()[0]
            faces = model.faces.astype(np.int64)
            return vertices, faces
        except Exception as e:
            logger.warning(f"Failed to load SMPL model: {e}. Using placeholder mesh.")

    # ── Placeholder mesh for development ──────────────────────────────
    # Generate a simplified body-shaped mesh from betas.
    # Beta[0] controls overall size, beta[1] height/width ratio, etc.
    return _generate_placeholder_mesh(betas)


def _generate_placeholder_mesh(betas: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Generate a simplified human-shaped mesh parameterized by SMPL betas.

    This is a development placeholder. The real pipeline uses the official
    SMPL model for mesh generation.

    Returns:
        vertices: (6890, 3) mesh vertices.
        faces: (13776, 3) mesh faces.
    """
    n_verts = 6890
    n_faces = 13776

    # Base body proportions (meters, centered at origin, standing on y=0)
    # Height ~1.75m, parameterized by betas
    height_scale = 1.0 + 0.05 * betas[0]  # beta[0] ~ overall size
    width_scale = 1.0 + 0.03 * betas[1]   # beta[1] ~ width
    depth_scale = 1.0 + 0.02 * betas[2]   # beta[2] ~ depth

    # Generate vertices as a noisy cylinder approximation of body shape
    rng = np.random.RandomState(42)  # Deterministic for same betas

    # Create body segments with appropriate radii
    segments = [
        # (y_start, y_end, num_verts, radius_x, radius_z)
        (0.0, 0.10, 400, 0.05, 0.05),     # feet
        (0.10, 0.45, 1200, 0.06, 0.05),   # calves
        (0.45, 0.50, 200, 0.05, 0.05),    # knees
        (0.50, 0.82, 1200, 0.08, 0.07),   # thighs
        (0.82, 0.85, 200, 0.04, 0.04),    # crotch
        (0.85, 1.05, 800, 0.14, 0.10),    # hips / pelvis
        (1.05, 1.20, 600, 0.13, 0.09),    # waist
        (1.20, 1.45, 800, 0.15, 0.11),    # chest
        (1.45, 1.55, 300, 0.04, 0.04),    # neck
        (1.55, 1.75, 400, 0.09, 0.09),    # head
    ]

    # Arms (offset from torso)
    arm_segments = [
        # (y_start, y_end, num_verts, radius, x_offset)
        (1.20, 1.40, 200, 0.04, 0.20),    # upper arm
        (0.95, 1.20, 200, 0.035, 0.22),   # forearm
        (0.85, 0.95, 90, 0.025, 0.23),    # wrist/hand
    ]

    vertices = np.zeros((n_verts, 3), dtype=np.float32)
    idx = 0

    for y_start, y_end, n, rx, rz in segments:
        if idx + n > n_verts:
            n = n_verts - idx
        y_vals = np.linspace(y_start, y_end, n)
        angles = np.linspace(0, 2 * np.pi, n, endpoint=False) + rng.uniform(0, 0.1, n)
        x_vals = rx * width_scale * np.cos(angles) * (1 + 0.05 * rng.randn(n))
        z_vals = rz * depth_scale * np.sin(angles) * (1 + 0.05 * rng.randn(n))
        vertices[idx:idx + n, 0] = x_vals
        vertices[idx:idx + n, 1] = y_vals * height_scale
        vertices[idx:idx + n, 2] = z_vals
        idx += n

    # Arms (left and right)
    for y_start, y_end, n, r, x_off in arm_segments:
        for side in [1.0, -1.0]:  # left, right
            if idx + n > n_verts:
                n = n_verts - idx
            if n <= 0:
                break
            y_vals = np.linspace(y_start, y_end, n)
            angles = np.linspace(0, 2 * np.pi, n, endpoint=False)
            x_vals = side * x_off * width_scale + r * np.cos(angles) * (1 + 0.03 * rng.randn(n))
            z_vals = r * np.sin(angles) * (1 + 0.03 * rng.randn(n))
            vertices[idx:idx + n, 0] = x_vals
            vertices[idx:idx + n, 1] = y_vals * height_scale
            vertices[idx:idx + n, 2] = z_vals
            idx += n

    # Fill remaining vertices if any
    if idx < n_verts:
        remaining = n_verts - idx
        vertices[idx:, 0] = rng.randn(remaining) * 0.02
        vertices[idx:, 1] = rng.uniform(0, 1.75, remaining) * height_scale
        vertices[idx:, 2] = rng.randn(remaining) * 0.02

    # Generate faces via Delaunay-like triangulation
    # In practice, SMPL faces are fixed topology. This is a placeholder.
    faces = np.zeros((n_faces, 3), dtype=np.int64)
    for i in range(n_faces):
        base = i % (n_verts - 2)
        faces[i] = [base, (base + 1) % n_verts, (base + 2) % n_verts]

    return vertices, faces


def _slice_mesh_at_height(
    vertices: np.ndarray,
    faces: np.ndarray,
    y_height: float,
    tolerance: float = 0.01,
) -> np.ndarray:
    """Slice a mesh with a horizontal plane at a given height.

    Finds the intersection contour of the mesh with the plane y = y_height.

    Args:
        vertices: (N, 3) mesh vertices.
        faces: (M, 3) mesh face indices.
        y_height: Height (y-coordinate) to slice at, in meters.
        tolerance: Vertex selection tolerance in meters.

    Returns:
        contour: (K, 2) array of (x, z) points forming the contour.
    """
    mesh = trimesh.Trimesh(vertices=vertices, faces=faces, process=False)

    try:
        # Use trimesh section to get exact cross-section
        plane_origin = [0, y_height, 0]
        plane_normal = [0, 1, 0]
        section = mesh.section(plane_origin=plane_origin, plane_normal=plane_normal)

        if section is not None:
            # Get 2D contour points (in the cutting plane)
            path_2d, _ = section.to_planar()
            if len(path_2d.vertices) > 2:
                return path_2d.vertices
    except Exception:
        pass

    # Fallback: select vertices near the slice height
    mask = np.abs(vertices[:, 1] - y_height) < tolerance
    nearby = vertices[mask]

    if len(nearby) < 3:
        # Widen tolerance
        mask = np.abs(vertices[:, 1] - y_height) < tolerance * 3
        nearby = vertices[mask]

    if len(nearby) < 3:
        return np.array([[0, 0]])

    # Return x, z coordinates
    return nearby[:, [0, 2]]


def _contour_circumference(contour: np.ndarray) -> float:
    """Calculate circumference of a 2D contour.

    Sorts points by angle from centroid, then sums segment lengths.

    Args:
        contour: (K, 2) array of points.

    Returns:
        Circumference in the same units as the input points (meters).
    """
    if len(contour) < 3:
        return 0.0

    # Center the contour
    centroid = contour.mean(axis=0)
    centered = contour - centroid

    # Sort by angle
    angles = np.arctan2(centered[:, 1], centered[:, 0])
    sorted_idx = np.argsort(angles)
    sorted_pts = contour[sorted_idx]

    # Sum segment lengths (closed polygon)
    diffs = np.diff(sorted_pts, axis=0, append=sorted_pts[:1])
    segment_lengths = np.sqrt(np.sum(diffs ** 2, axis=1))

    return float(np.sum(segment_lengths))


def _compute_distance(vertices: np.ndarray, idx_a: int, idx_b: int) -> float:
    """Euclidean distance between two vertices."""
    return float(np.linalg.norm(vertices[idx_a] - vertices[idx_b]))


# ── Measurement region definitions ────────────────────────────────────────
# Each region is defined by the Y-height at which to slice,
# specified as a ratio between two landmark Y-coordinates.

CIRCUMFERENCE_REGIONS = {
    "neck": {
        "landmarks": ("neck_front", "neck_back"),
        "y_offset": 0.0,  # Slice at midpoint of landmarks
    },
    "chest": {
        "landmarks": ("sternum", "sternum"),
        "y_offset": 0.0,
    },
    "waist": {
        "landmarks": ("navel", "navel"),
        "y_offset": 0.02,  # Slightly above navel (natural waist)
    },
    "hips": {
        "landmarks": ("hip_front", "hip_back"),
        "y_offset": 0.0,
    },
    "shoulders": {
        "landmarks": ("left_shoulder_tip", "right_shoulder_tip"),
        "y_offset": 0.0,
    },
    "left_bicep": {
        "landmarks": ("left_bicep_upper", "left_bicep_lower"),
        "y_offset": 0.0,
    },
    "right_bicep": {
        "landmarks": ("right_bicep_upper", "right_bicep_lower"),
        "y_offset": 0.0,
    },
    "left_forearm": {
        "landmarks": ("left_elbow", "left_forearm"),
        "y_offset": 0.0,
    },
    "right_forearm": {
        "landmarks": ("right_elbow", "right_forearm"),
        "y_offset": 0.0,
    },
    "left_thigh": {
        "landmarks": ("left_thigh_upper", "left_thigh_lower"),
        "y_offset": 0.0,
    },
    "right_thigh": {
        "landmarks": ("right_thigh_upper", "right_thigh_lower"),
        "y_offset": 0.0,
    },
    "left_calf": {
        "landmarks": ("left_knee", "left_calf"),
        "y_offset": 0.0,
    },
    "right_calf": {
        "landmarks": ("right_knee", "right_calf"),
        "y_offset": 0.0,
    },
    "wrist": {
        "landmarks": ("left_wrist", "left_wrist"),
        "y_offset": 0.0,
    },
}


class MeasurementExtractor:
    """Extract anthropometric measurements from an SMPL mesh."""

    def __init__(self, smpl_model_path: Optional[str] = None):
        """
        Args:
            smpl_model_path: Path to SMPL model .npz file.
                           If None, uses placeholder mesh generation.
        """
        self.smpl_model_path = smpl_model_path

    def extract(
        self,
        betas: np.ndarray,
        height_cm: float,
    ) -> MeasurementSet:
        """Extract all body measurements from SMPL shape parameters.

        Generates the SMPL mesh in T-pose, then slices at anatomical
        planes to compute circumferences, and uses landmark distances
        for length measurements.

        Args:
            betas: (10,) SMPL shape parameters.
            height_cm: Known height in cm (used to scale mesh to real units).

        Returns:
            MeasurementSet with all circumferences and lengths.
        """
        logger.info("Extracting measurements from SMPL mesh")

        # Generate T-pose mesh
        vertices, faces = _get_smpl_mesh(betas, self.smpl_model_path)

        # Scale mesh to match real height
        mesh_height = vertices[:, 1].max() - vertices[:, 1].min()
        if mesh_height > 0:
            scale = (height_cm / 100.0) / mesh_height  # Convert cm to meters
            vertices = vertices * scale
        else:
            scale = 1.0

        logger.debug(f"Mesh height: {mesh_height:.3f}m, scale factor: {scale:.3f}")

        # ── Extract circumferences ────────────────────────────────────
        measurements = MeasurementSet()
        measurements.height = height_cm

        for region_name, region_def in CIRCUMFERENCE_REGIONS.items():
            lm_a_name, lm_b_name = region_def["landmarks"]
            lm_a = LANDMARKS.get(lm_a_name)
            lm_b = LANDMARKS.get(lm_b_name)

            if lm_a is None or lm_b is None:
                logger.warning(f"Landmark not found for region {region_name}")
                continue

            # Ensure landmark indices are within vertex bounds
            if lm_a >= len(vertices) or lm_b >= len(vertices):
                logger.warning(f"Landmark index out of bounds for {region_name}")
                continue

            # Slice height = midpoint of landmarks + offset
            y_a = vertices[lm_a, 1]
            y_b = vertices[lm_b, 1]
            slice_y = (y_a + y_b) / 2.0 + region_def["y_offset"]

            contour = _slice_mesh_at_height(vertices, faces, slice_y)
            circumference_m = _contour_circumference(contour)
            circumference_cm = circumference_m * 100.0  # Convert to cm

            setattr(measurements, region_name, circumference_cm)

        # ── Extract length measurements ───────────────────────────────
        measurements.arm_span = self._compute_arm_span(vertices)
        measurements.shoulder_width = self._compute_shoulder_width(vertices)
        measurements.torso_length = self._compute_torso_length(vertices)
        measurements.inseam = self._compute_inseam(vertices)

        logger.info(
            f"Measurement extraction complete: "
            f"waist={measurements.waist:.1f}cm, "
            f"chest={measurements.chest:.1f}cm, "
            f"hips={measurements.hips:.1f}cm"
        )

        return measurements

    def get_mesh(self, betas: np.ndarray, height_cm: float) -> tuple[np.ndarray, np.ndarray]:
        """Get the scaled SMPL mesh for visualization.

        Args:
            betas: (10,) SMPL shape parameters.
            height_cm: Known height in cm.

        Returns:
            vertices: (6890, 3) scaled mesh vertices.
            faces: (13776, 3) mesh faces.
        """
        vertices, faces = _get_smpl_mesh(betas, self.smpl_model_path)
        mesh_height = vertices[:, 1].max() - vertices[:, 1].min()
        if mesh_height > 0:
            scale = (height_cm / 100.0) / mesh_height
            vertices = vertices * scale
        return vertices, faces

    def _compute_arm_span(self, vertices: np.ndarray) -> float:
        """Arm span: left hand tip to right hand tip, in cm."""
        lm_left = LANDMARKS.get("left_hand_tip")
        lm_right = LANDMARKS.get("right_hand_tip")
        if lm_left is None or lm_right is None:
            return 0.0
        if lm_left >= len(vertices) or lm_right >= len(vertices):
            return 0.0
        return _compute_distance(vertices, lm_left, lm_right) * 100.0

    def _compute_shoulder_width(self, vertices: np.ndarray) -> float:
        """Shoulder width: left shoulder tip to right shoulder tip, in cm."""
        lm_left = LANDMARKS.get("left_shoulder_tip")
        lm_right = LANDMARKS.get("right_shoulder_tip")
        if lm_left is None or lm_right is None:
            return 0.0
        if lm_left >= len(vertices) or lm_right >= len(vertices):
            return 0.0
        return _compute_distance(vertices, lm_left, lm_right) * 100.0

    def _compute_torso_length(self, vertices: np.ndarray) -> float:
        """Torso length: sternum to crotch, in cm."""
        lm_top = LANDMARKS.get("sternum")
        lm_bottom = LANDMARKS.get("crotch")
        if lm_top is None or lm_bottom is None:
            return 0.0
        if lm_top >= len(vertices) or lm_bottom >= len(vertices):
            return 0.0
        return _compute_distance(vertices, lm_top, lm_bottom) * 100.0

    def _compute_inseam(self, vertices: np.ndarray) -> float:
        """Inseam: crotch to left ankle, in cm."""
        lm_top = LANDMARKS.get("crotch")
        lm_bottom = LANDMARKS.get("left_ankle")
        if lm_top is None or lm_bottom is None:
            return 0.0
        if lm_top >= len(vertices) or lm_bottom >= len(vertices):
            return 0.0
        return _compute_distance(vertices, lm_top, lm_bottom) * 100.0
