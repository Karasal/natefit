import type { PoseKeypoints } from '@/lib/types';
import {
  POSE_LANDMARKS,
  MIN_VISIBILITY,
  REQUIRED_FRONT_LANDMARKS,
  STABILITY_THRESHOLD_PX,
} from './constants';
import { distance2D } from '@/lib/utils/math';

export interface PoseValidation {
  valid: boolean;
  issues: string[];
  stability: number; // 0-1, how stable the pose is
}

/**
 * Validate a front-facing pose for body scanning.
 * Checks: visibility, centering, arm position, facing direction.
 */
export function validateFrontPose(
  keypoints: PoseKeypoints,
  imageWidth: number,
  imageHeight: number
): PoseValidation {
  const issues: string[] = [];

  // 1. Check all required landmarks are visible
  for (const idx of REQUIRED_FRONT_LANDMARKS) {
    const kp = keypoints[idx];
    if (!kp || kp.visibility < MIN_VISIBILITY) {
      issues.push('Full body not visible. Step back.');
      break;
    }
  }

  // 2. Check person is centered
  const lShoulder = keypoints[POSE_LANDMARKS.LEFT_SHOULDER];
  const rShoulder = keypoints[POSE_LANDMARKS.RIGHT_SHOULDER];
  if (lShoulder && rShoulder) {
    const centerX = ((lShoulder.x + rShoulder.x) / 2) * imageWidth;
    const midImage = imageWidth / 2;
    const offsetRatio = Math.abs(centerX - midImage) / imageWidth;
    if (offsetRatio > 0.15) {
      issues.push('Move to center of frame.');
    }
  }

  // 3. Check arms are away from body (A-pose)
  const lElbow = keypoints[POSE_LANDMARKS.LEFT_ELBOW];
  const rElbow = keypoints[POSE_LANDMARKS.RIGHT_ELBOW];
  const lHip = keypoints[POSE_LANDMARKS.LEFT_HIP];
  const rHip = keypoints[POSE_LANDMARKS.RIGHT_HIP];

  if (lElbow && lHip && lShoulder) {
    const elbowToHipDist = Math.abs(lElbow.x - lHip.x) * imageWidth;
    const shoulderToHipDist = Math.abs(lShoulder.x - lHip.x) * imageWidth;
    if (elbowToHipDist < shoulderToHipDist * 0.3) {
      issues.push('Move arms away from body.');
    }
  }

  // 4. Check person is facing camera (shoulders roughly equal width)
  if (lShoulder && rShoulder) {
    const shoulderWidth = Math.abs(lShoulder.x - rShoulder.x) * imageWidth;
    const hipWidth = lHip && rHip ? Math.abs(lHip.x - rHip.x) * imageWidth : shoulderWidth;
    // In frontal view, shoulders should be wider than ~60% of hip width
    if (shoulderWidth < hipWidth * 0.6) {
      issues.push('Face the camera directly.');
    }
  }

  return {
    valid: issues.length === 0,
    issues,
    stability: 0, // Calculated separately via frame comparison
  };
}

/**
 * Validate a side-profile pose.
 * Key check: shoulder width should be narrow (< 40% of frontal hip width).
 */
export function validateSidePose(
  keypoints: PoseKeypoints,
  imageWidth: number,
  imageHeight: number
): PoseValidation {
  const issues: string[] = [];

  // Check visibility
  const nose = keypoints[POSE_LANDMARKS.NOSE];
  const lShoulder = keypoints[POSE_LANDMARKS.LEFT_SHOULDER];
  const rShoulder = keypoints[POSE_LANDMARKS.RIGHT_SHOULDER];
  const lHip = keypoints[POSE_LANDMARKS.LEFT_HIP];
  const rHip = keypoints[POSE_LANDMARKS.RIGHT_HIP];

  if (!nose || (nose.visibility ?? 0) < MIN_VISIBILITY) {
    issues.push('Face not visible. Turn to the side.');
  }

  // In side view, shoulders should appear narrow
  if (lShoulder && rShoulder) {
    const shoulderWidth = Math.abs(lShoulder.x - rShoulder.x) * imageWidth;
    // In true profile, both shoulders nearly overlap
    if (shoulderWidth > imageWidth * 0.15) {
      issues.push('Turn more to the side.');
    }
  }

  // Check centering
  if (lHip && rHip) {
    const centerX = ((lHip.x + rHip.x) / 2) * imageWidth;
    const midImage = imageWidth / 2;
    if (Math.abs(centerX - midImage) / imageWidth > 0.2) {
      issues.push('Move to center of frame.');
    }
  }

  return {
    valid: issues.length === 0,
    issues,
    stability: 0,
  };
}

/**
 * Calculate pose stability between two consecutive frames.
 * Returns 0-1 where 1 = perfectly stable.
 */
export function calculateStability(
  current: PoseKeypoints,
  previous: PoseKeypoints,
  imageWidth: number,
  imageHeight: number
): number {
  let totalDist = 0;
  let count = 0;

  for (let i = 0; i < Math.min(current.length, previous.length); i++) {
    const c = current[i];
    const p = previous[i];
    if (!c || !p) continue;
    if (c.visibility < MIN_VISIBILITY || p.visibility < MIN_VISIBILITY) continue;

    const dist = distance2D(
      c.x * imageWidth, c.y * imageHeight,
      p.x * imageWidth, p.y * imageHeight
    );
    totalDist += dist;
    count++;
  }

  if (count === 0) return 0;

  const avgDist = totalDist / count;
  // Map average pixel distance to 0-1 stability score
  // 0px = 1.0 stability, STABILITY_THRESHOLD_PX = 0.0 stability
  return Math.max(0, 1 - avgDist / STABILITY_THRESHOLD_PX);
}
