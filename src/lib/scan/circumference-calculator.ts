import type { CircumferenceResult, MeasurementRegion, RegionWidths } from '@/lib/types';
import { ellipseCircumference } from '@/lib/utils/math';
import { CORRECTION_FACTORS } from './constants';

/**
 * Calculate circumference from frontal and sagittal widths using the ellipse model.
 *
 * Model: Cross-sections of the human body approximate ellipses.
 * - Semi-major axis a = frontal_width / 2 (from front photo)
 * - Semi-minor axis b = sagittal_depth / 2 (from side photo)
 * - Circumference ≈ Ramanujan's approximation for ellipse perimeter
 *
 * Region-specific correction factors account for:
 * - Non-elliptical shapes (e.g., thighs are more circular)
 * - Clothing compression effects
 * - Systematic bias from camera perspective
 */
export function calculateCircumference(
  region: MeasurementRegion,
  widths: RegionWidths
): CircumferenceResult {
  const a = widths.frontal_cm / 2; // semi-major
  const b = widths.sagittal_cm / 2; // semi-minor

  // Raw ellipse circumference
  const rawCircumference = ellipseCircumference(a, b);

  // Apply region-specific correction
  const correctionFactor = CORRECTION_FACTORS[region];
  const circumference = rawCircumference * correctionFactor;

  // Confidence: higher when the ellipse is more circular (a ≈ b)
  // and when both measurements are reasonable
  const aspectRatio = Math.min(a, b) / Math.max(a, b);
  const confidence = Math.min(1, aspectRatio * 1.2); // Max out at ~0.83 ratio

  return {
    region,
    circumference_cm: Math.round(circumference * 10) / 10,
    frontal_width_cm: Math.round(widths.frontal_cm * 10) / 10,
    sagittal_depth_cm: Math.round(widths.sagittal_cm * 10) / 10,
    confidence: Math.round(confidence * 100) / 100,
  };
}

/**
 * Calculate all body circumferences from frontal and sagittal widths.
 */
export function calculateAllCircumferences(
  regionWidths: Map<MeasurementRegion, RegionWidths>
): CircumferenceResult[] {
  const results: CircumferenceResult[] = [];

  for (const [region, widths] of regionWidths) {
    if (widths.frontal_cm > 0 && widths.sagittal_cm > 0) {
      results.push(calculateCircumference(region, widths));
    }
  }

  return results;
}

/**
 * Calculate overall confidence score from individual region confidences.
 * Weighted: core measurements (waist, chest, hips) count more.
 */
export function calculateOverallConfidence(results: CircumferenceResult[]): number {
  if (results.length === 0) return 0;

  const coreRegions: MeasurementRegion[] = ['waist', 'chest', 'hips'];
  let totalWeight = 0;
  let weightedSum = 0;

  for (const r of results) {
    const weight = coreRegions.includes(r.region) ? 2 : 1;
    weightedSum += r.confidence * weight;
    totalWeight += weight;
  }

  return Math.round((weightedSum / totalWeight) * 100) / 100;
}
