import type { PoseKeypoints, MeasurementRegion, SilhouetteWidth } from '@/lib/types';
import { POSE_LANDMARKS, REGION_Y_RATIOS } from './constants';
import { lerp } from '@/lib/utils/math';

/**
 * Extract body widths from a segmentation mask at keypoint-defined Y positions.
 *
 * For each measurement region:
 * 1. Determine Y coordinate from pose landmarks
 * 2. Scan mask horizontally at that Y
 * 3. Find leftmost and rightmost body pixels → width
 */
export function analyzeSilhouette(
  mask: Uint8Array,
  maskWidth: number,
  maskHeight: number,
  keypoints: PoseKeypoints
): SilhouetteWidth[] {
  const results: SilhouetteWidth[] = [];

  // Core regions defined by Y-ratio between landmarks
  for (const [regionName, config] of Object.entries(REGION_Y_RATIOS)) {
    const fromKp = keypoints[config.from];
    const toKp = keypoints[config.to];

    if (!fromKp || !toKp) continue;

    const y = Math.round(lerp(fromKp.y * maskHeight, toKp.y * maskHeight, config.ratio));
    const width = scanRow(mask, maskWidth, y);

    if (width) {
      results.push({
        region: regionName as MeasurementRegion,
        ...width,
      });
    }
  }

  // Shoulders: measured at shoulder landmark Y
  const lShoulder = keypoints[POSE_LANDMARKS.LEFT_SHOULDER];
  const rShoulder = keypoints[POSE_LANDMARKS.RIGHT_SHOULDER];
  if (lShoulder && rShoulder) {
    const y = Math.round((lShoulder.y + rShoulder.y) / 2 * maskHeight);
    const width = scanRow(mask, maskWidth, y);
    if (width) {
      results.push({ region: 'shoulders', ...width });
    }
  }

  // Bilateral limbs
  addLimbWidth(results, mask, maskWidth, maskHeight, keypoints, 'left_bicep',
    POSE_LANDMARKS.LEFT_SHOULDER, POSE_LANDMARKS.LEFT_ELBOW, 0.4);
  addLimbWidth(results, mask, maskWidth, maskHeight, keypoints, 'right_bicep',
    POSE_LANDMARKS.RIGHT_SHOULDER, POSE_LANDMARKS.RIGHT_ELBOW, 0.4);
  addLimbWidth(results, mask, maskWidth, maskHeight, keypoints, 'left_forearm',
    POSE_LANDMARKS.LEFT_ELBOW, POSE_LANDMARKS.LEFT_WRIST, 0.4);
  addLimbWidth(results, mask, maskWidth, maskHeight, keypoints, 'right_forearm',
    POSE_LANDMARKS.RIGHT_ELBOW, POSE_LANDMARKS.RIGHT_WRIST, 0.4);
  addLimbWidth(results, mask, maskWidth, maskHeight, keypoints, 'left_thigh',
    POSE_LANDMARKS.LEFT_HIP, POSE_LANDMARKS.LEFT_KNEE, 0.35);
  addLimbWidth(results, mask, maskWidth, maskHeight, keypoints, 'right_thigh',
    POSE_LANDMARKS.RIGHT_HIP, POSE_LANDMARKS.RIGHT_KNEE, 0.35);
  addLimbWidth(results, mask, maskWidth, maskHeight, keypoints, 'left_calf',
    POSE_LANDMARKS.LEFT_KNEE, POSE_LANDMARKS.LEFT_ANKLE, 0.35);
  addLimbWidth(results, mask, maskWidth, maskHeight, keypoints, 'right_calf',
    POSE_LANDMARKS.RIGHT_KNEE, POSE_LANDMARKS.RIGHT_ANKLE, 0.35);

  return results;
}

/**
 * Scan a single row of the mask to find body width.
 */
function scanRow(
  mask: Uint8Array,
  width: number,
  y: number
): { y_position: number; left_edge: number; right_edge: number; width_pixels: number } | null {
  if (y < 0 || y >= mask.length / width) return null;

  const rowStart = y * width;
  let leftEdge = -1;
  let rightEdge = -1;

  for (let x = 0; x < width; x++) {
    if (mask[rowStart + x] > 0) {
      if (leftEdge === -1) leftEdge = x;
      rightEdge = x;
    }
  }

  if (leftEdge === -1 || rightEdge === -1) return null;

  const widthPx = rightEdge - leftEdge;
  if (widthPx < 5) return null; // Too narrow, likely noise

  return {
    y_position: y,
    left_edge: leftEdge,
    right_edge: rightEdge,
    width_pixels: widthPx,
  };
}

/**
 * Add a limb width measurement using two landmarks and a ratio.
 */
function addLimbWidth(
  results: SilhouetteWidth[],
  mask: Uint8Array,
  maskWidth: number,
  maskHeight: number,
  keypoints: PoseKeypoints,
  region: MeasurementRegion,
  fromIdx: number,
  toIdx: number,
  ratio: number
) {
  const from = keypoints[fromIdx];
  const to = keypoints[toIdx];
  if (!from || !to) return;

  const y = Math.round(lerp(from.y * maskHeight, to.y * maskHeight, ratio));
  const width = scanRow(mask, maskWidth, y);

  if (width) {
    results.push({ region, ...width });
  }
}

/**
 * Convert pixel widths to cm using the calibration scale.
 */
export function pixelsToCm(widthPixels: number, pixelsPerCm: number): number {
  return widthPixels / pixelsPerCm;
}
