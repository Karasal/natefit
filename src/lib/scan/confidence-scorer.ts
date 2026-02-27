import type { CircumferenceResult, PoseKeypoints, CalibrationData } from '@/lib/types';
import { MIN_VISIBILITY } from './constants';

/**
 * Score confidence of overall scan results.
 * Factors: landmark visibility, calibration quality, measurement spread, stability.
 */
export function scoreScanConfidence(
  circumferences: CircumferenceResult[],
  frontKeypoints: PoseKeypoints,
  sideKeypoints: PoseKeypoints,
  calibration: CalibrationData
): number {
  const scores: number[] = [];

  // 1. Landmark visibility score (0-1)
  scores.push(keypointVisibilityScore(frontKeypoints));
  scores.push(keypointVisibilityScore(sideKeypoints));

  // 2. Calibration quality (0-1)
  scores.push(calibrationScore(calibration));

  // 3. Measurement coverage: how many regions were measured
  const expectedRegions = 14;
  scores.push(Math.min(1, circumferences.length / expectedRegions));

  // 4. Average circumference confidence
  if (circumferences.length > 0) {
    const avgConf = circumferences.reduce((sum, c) => sum + c.confidence, 0) / circumferences.length;
    scores.push(avgConf);
  }

  // Weighted average
  const weights = [0.2, 0.2, 0.15, 0.2, 0.25];
  let weighted = 0;
  let totalWeight = 0;
  for (let i = 0; i < scores.length; i++) {
    weighted += scores[i] * (weights[i] || 0.2);
    totalWeight += weights[i] || 0.2;
  }

  return Math.round((weighted / totalWeight) * 100) / 100;
}

function keypointVisibilityScore(keypoints: PoseKeypoints): number {
  if (keypoints.length === 0) return 0;
  const visible = keypoints.filter((kp) => kp.visibility >= MIN_VISIBILITY).length;
  return visible / keypoints.length;
}

function calibrationScore(calibration: CalibrationData): number {
  const { pixels_per_cm } = calibration;
  if (pixels_per_cm == null) return 0.5;
  // Ideal range: 3-10 px/cm for typical phone photos
  if (pixels_per_cm >= 3 && pixels_per_cm <= 10) return 1;
  if (pixels_per_cm >= 2 && pixels_per_cm <= 15) return 0.8;
  return 0.5;
}
