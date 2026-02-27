'use client';

import { useCallback, useState } from 'react';
import type { CalibrationData, ScanResult } from '@/lib/types';

interface UseScanProcessorReturn {
  isProcessing: boolean;
  progress: number;
  error: string | null;
  process: (
    frontImage: Blob,
    sideImage: Blob,
    calibration: CalibrationData
  ) => Promise<ScanResult | null>;
}

export function useScanProcessor(): UseScanProcessorReturn {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const process = useCallback(
    async (
      frontImage: Blob,
      sideImage: Blob,
      calibration: CalibrationData
    ): Promise<ScanResult | null> => {
      setIsProcessing(true);
      setProgress(0);
      setError(null);

      // Simulate progress while waiting for server response
      const progressSteps = [
        { target: 20, delay: 300 },
        { target: 40, delay: 800 },
        { target: 60, delay: 1500 },
        { target: 75, delay: 2500 },
        { target: 85, delay: 4000 },
        { target: 90, delay: 6000 },
      ];

      let stepIndex = 0;
      const interval = setInterval(() => {
        if (stepIndex < progressSteps.length) {
          setProgress(progressSteps[stepIndex].target);
          stepIndex++;
        }
      }, 1200);

      try {
        const formData = new FormData();
        formData.append('front_image', frontImage, 'front.jpg');
        formData.append('side_image', sideImage, 'side.jpg');
        formData.append('height_cm', String(calibration.height_cm));
        formData.append('weight_kg', String(calibration.weight_kg));
        formData.append('age', String(calibration.age));
        formData.append('sex', calibration.sex);

        const response = await fetch('/api/scan/process', {
          method: 'POST',
          body: formData,
        });

        clearInterval(interval);

        if (!response.ok) {
          const body = await response.json().catch(() => ({ error: 'Scan processing failed' }));
          throw new Error(body.error || `Server error: ${response.status}`);
        }

        setProgress(95);
        const result: ScanResult = await response.json();

        setProgress(100);
        setIsProcessing(false);
        return result;
      } catch (err) {
        clearInterval(interval);
        const message = err instanceof Error ? err.message : 'Scan processing failed';
        setError(message);
        setIsProcessing(false);
        return null;
      }
    },
    []
  );

  return { isProcessing, progress, error, process };
}
