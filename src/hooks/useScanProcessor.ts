'use client';

import { useCallback, useState } from 'react';
import type {
  CalibrationData,
  PoseKeypoints,
  ScanResult,
  MeasurementRegion,
  RegionWidths,
} from '@/lib/types';
import { analyzeSilhouette, pixelsToCm } from '@/lib/scan/silhouette-analyzer';
import { calculateAllCircumferences, calculateOverallConfidence } from '@/lib/scan/circumference-calculator';
import { calculateBodyComposition } from '@/lib/scan/body-composition';
import { scoreScanConfidence } from '@/lib/scan/confidence-scorer';
import { useBodySegmentation } from './useBodySegmentation';

interface UseScanProcessorReturn {
  isProcessing: boolean;
  progress: number;
  error: string | null;
  process: (
    frontImage: ImageData,
    sideImage: ImageData,
    frontKeypoints: PoseKeypoints,
    sideKeypoints: PoseKeypoints,
    calibration: CalibrationData
  ) => Promise<ScanResult | null>;
}

export function useScanProcessor(): UseScanProcessorReturn {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const { segment } = useBodySegmentation();

  const process = useCallback(
    async (
      frontImage: ImageData,
      sideImage: ImageData,
      frontKeypoints: PoseKeypoints,
      sideKeypoints: PoseKeypoints,
      calibration: CalibrationData
    ): Promise<ScanResult | null> => {
      setIsProcessing(true);
      setProgress(0);
      setError(null);

      try {
        // Step 1: Body segmentation (front)
        setProgress(10);
        const frontMask = await segment(frontImage);
        if (!frontMask) throw new Error('Front body segmentation failed');

        // Step 2: Body segmentation (side)
        setProgress(30);
        const sideMask = await segment(sideImage);
        if (!sideMask) throw new Error('Side body segmentation failed');

        // Step 3: Silhouette analysis
        setProgress(50);
        const frontWidths = analyzeSilhouette(
          frontMask, frontImage.width, frontImage.height, frontKeypoints
        );
        const sideWidths = analyzeSilhouette(
          sideMask, sideImage.width, sideImage.height, sideKeypoints
        );

        // Step 4: Map frontal + sagittal widths per region
        setProgress(65);
        const regionWidths = new Map<MeasurementRegion, RegionWidths>();

        for (const fw of frontWidths) {
          const sw = sideWidths.find((s) => s.region === fw.region);
          if (sw) {
            regionWidths.set(fw.region, {
              frontal_cm: pixelsToCm(fw.width_pixels, calibration.pixels_per_cm),
              sagittal_cm: pixelsToCm(sw.width_pixels, calibration.pixels_per_cm),
            });
          }
        }

        // Step 5: Calculate circumferences
        setProgress(80);
        const circumferences = calculateAllCircumferences(regionWidths);

        // Step 6: Body composition
        setProgress(90);
        const waistResult = circumferences.find((c) => c.region === 'waist');
        const neckResult = circumferences.find((c) => c.region === 'neck');
        const hipsResult = circumferences.find((c) => c.region === 'hips');

        let composition;
        if (waistResult && neckResult && hipsResult) {
          composition = calculateBodyComposition(
            calibration.sex,
            calibration.age,
            calibration.height_cm,
            calibration.weight_kg,
            waistResult.circumference_cm,
            neckResult.circumference_cm,
            hipsResult.circumference_cm
          );
        } else {
          // Fallback: use BMI-only composition
          const bmi = calibration.weight_kg / ((calibration.height_cm / 100) ** 2);
          composition = calculateBodyComposition(
            calibration.sex,
            calibration.age,
            calibration.height_cm,
            calibration.weight_kg,
            calibration.height_cm * 0.44, // Average waist-to-height ratio
            calibration.height_cm * 0.21, // Average neck-to-height ratio
            calibration.height_cm * 0.52  // Average hip-to-height ratio
          );
        }

        // Step 7: Confidence scoring
        setProgress(95);
        const confidence = scoreScanConfidence(
          circumferences,
          frontKeypoints,
          sideKeypoints,
          calibration
        );

        setProgress(100);
        setIsProcessing(false);

        return {
          circumferences,
          composition,
          confidence_score: confidence,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Scan processing failed';
        setError(message);
        setIsProcessing(false);
        return null;
      }
    },
    [segment]
  );

  return { isProcessing, progress, error, process };
}
