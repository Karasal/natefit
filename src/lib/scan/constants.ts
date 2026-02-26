import type { MeasurementRegion } from '@/lib/types';

/**
 * BlazePose landmark indices (33 keypoints)
 * https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker
 */
export const POSE_LANDMARKS = {
  NOSE: 0,
  LEFT_EYE_INNER: 1,
  LEFT_EYE: 2,
  LEFT_EYE_OUTER: 3,
  RIGHT_EYE_INNER: 4,
  RIGHT_EYE: 5,
  RIGHT_EYE_OUTER: 6,
  LEFT_EAR: 7,
  RIGHT_EAR: 8,
  MOUTH_LEFT: 9,
  MOUTH_RIGHT: 10,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_PINKY: 17,
  RIGHT_PINKY: 18,
  LEFT_INDEX: 19,
  RIGHT_INDEX: 20,
  LEFT_THUMB: 21,
  RIGHT_THUMB: 22,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
  LEFT_HEEL: 29,
  RIGHT_HEEL: 30,
  LEFT_FOOT_INDEX: 31,
  RIGHT_FOOT_INDEX: 32,
} as const;

/**
 * Region-specific correction factors.
 * These account for the ellipse model's tendency to under/over-estimate
 * certain body regions. Tuned via validation against tape measurements.
 */
export const CORRECTION_FACTORS: Record<MeasurementRegion, number> = {
  neck: 1.02,
  shoulders: 1.08,
  chest: 1.05,
  left_bicep: 1.01,
  right_bicep: 1.01,
  left_forearm: 1.01,
  right_forearm: 1.01,
  wrist: 1.00,
  waist: 1.03,
  hips: 1.04,
  left_thigh: 1.06,
  right_thigh: 1.06,
  left_calf: 1.02,
  right_calf: 1.02,
};

/**
 * How far along the Y-axis (as ratio between two landmarks) to measure each region.
 * For bilateral regions (bicep, thigh, calf), the left/right landmarks are used directly.
 */
export const REGION_Y_RATIOS: Record<string, { from: number; to: number; ratio: number }> = {
  neck: { from: POSE_LANDMARKS.NOSE, to: POSE_LANDMARKS.LEFT_SHOULDER, ratio: 0.7 },
  chest: { from: POSE_LANDMARKS.LEFT_SHOULDER, to: POSE_LANDMARKS.LEFT_HIP, ratio: 0.15 },
  waist: { from: POSE_LANDMARKS.LEFT_SHOULDER, to: POSE_LANDMARKS.LEFT_HIP, ratio: 0.65 },
  hips: { from: POSE_LANDMARKS.LEFT_SHOULDER, to: POSE_LANDMARKS.LEFT_HIP, ratio: 0.95 },
};

/**
 * Minimum keypoint visibility threshold for a valid detection.
 */
export const MIN_VISIBILITY = 0.5;

/**
 * Minimum required keypoints for a valid front pose.
 */
export const REQUIRED_FRONT_LANDMARKS = [
  POSE_LANDMARKS.LEFT_SHOULDER,
  POSE_LANDMARKS.RIGHT_SHOULDER,
  POSE_LANDMARKS.LEFT_HIP,
  POSE_LANDMARKS.RIGHT_HIP,
  POSE_LANDMARKS.LEFT_KNEE,
  POSE_LANDMARKS.RIGHT_KNEE,
  POSE_LANDMARKS.LEFT_ANKLE,
  POSE_LANDMARKS.RIGHT_ANKLE,
];

/**
 * Stability threshold: max pixel variance for auto-capture.
 */
export const STABILITY_THRESHOLD_PX = 5;

/**
 * Stable frames required before auto-capture (at ~30fps, 1.5s ≈ 45 frames).
 */
export const STABLE_FRAMES_REQUIRED = 45;
