import type { PoseKeypoints, CalibrationData, Sex } from '@/lib/types';
import { POSE_LANDMARKS } from './constants';
import { distance2D } from '@/lib/utils/math';

/**
 * Calculate pixels-per-cm scale factor using the person's known height
 * and the detected pose keypoints.
 *
 * Strategy: Measure pixel distance from top of head to ankle,
 * then divide by known height in cm.
 */
export function calibrateFromHeight(
  keypoints: PoseKeypoints,
  imageWidth: number,
  imageHeight: number,
  heightCm: number,
  weightKg: number,
  age: number,
  sex: Sex
): CalibrationData {
  // Get head top (approximate from nose + offset) and ankle
  const nose = keypoints[POSE_LANDMARKS.NOSE];
  const lAnkle = keypoints[POSE_LANDMARKS.LEFT_ANKLE];
  const rAnkle = keypoints[POSE_LANDMARKS.RIGHT_ANKLE];

  if (!nose || !lAnkle || !rAnkle) {
    throw new Error('Cannot calibrate: missing nose or ankle keypoints');
  }

  // Approximate head top: nose is ~90% down from actual top of head
  const headTopY = nose.y * imageHeight - (nose.y * imageHeight * 0.1);
  const ankleY = ((lAnkle.y + rAnkle.y) / 2) * imageHeight;

  // Person's pixel height from head to ankle (~95% of total height)
  const pixelHeight = ankleY - headTopY;
  const effectiveHeightCm = heightCm * 0.95; // Head-to-ankle is ~95% of total height

  const pixelsPerCm = pixelHeight / effectiveHeightCm;

  return {
    height_cm: heightCm,
    weight_kg: weightKg,
    age,
    sex,
    pixels_per_cm: pixelsPerCm,
    image_width: imageWidth,
    image_height: imageHeight,
  };
}

/**
 * Validate that calibration data is reasonable.
 */
export function validateCalibration(data: CalibrationData): { valid: boolean; reason?: string } {
  // pixels_per_cm should be reasonable for a phone photo
  // At 1080p with person at ~2m distance: roughly 3-8 px/cm
  if (data.pixels_per_cm < 1) {
    return { valid: false, reason: 'Scale too small — person may be too far from camera' };
  }
  if (data.pixels_per_cm > 20) {
    return { valid: false, reason: 'Scale too large — person may be too close to camera' };
  }

  return { valid: true };
}
