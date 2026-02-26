'use client';

import { useCallback, useRef, useState } from 'react';

interface UseBodySegmentationReturn {
  isLoading: boolean;
  error: string | null;
  segment: (imageData: ImageData) => Promise<Uint8Array | null>;
}

/**
 * TensorFlow.js body segmentation.
 * Returns a binary mask (0 = background, 255 = body).
 */
export function useBodySegmentation(): UseBodySegmentationReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const segmenterRef = useRef<any>(null);
  const loadingRef = useRef(false);

  const loadModel = useCallback(async () => {
    if (segmenterRef.current || loadingRef.current) return;
    loadingRef.current = true;
    setIsLoading(true);

    try {
      // Dynamic import to avoid SSR issues
      const tf = await import('@tensorflow/tfjs');
      await tf.ready();

      const bodySegmentation = await import('@tensorflow-models/body-segmentation');

      segmenterRef.current = await bodySegmentation.createSegmenter(
        bodySegmentation.SupportedModels.MediaPipeSelfieSegmentation,
        {
          runtime: 'tfjs',
          modelType: 'general',
        }
      );

      setIsLoading(false);
    } catch (err) {
      setError('Failed to load body segmentation model');
      setIsLoading(false);
    } finally {
      loadingRef.current = false;
    }
  }, []);

  const segment = useCallback(
    async (imageData: ImageData): Promise<Uint8Array | null> => {
      if (!segmenterRef.current) {
        await loadModel();
      }

      const segmenter = segmenterRef.current;
      if (!segmenter) return null;

      try {
        // Create a temporary canvas to pass to the segmenter
        const canvas = document.createElement('canvas');
        canvas.width = imageData.width;
        canvas.height = imageData.height;
        const ctx = canvas.getContext('2d')!;
        ctx.putImageData(imageData, 0, 0);

        const segmentation = await segmenter.segmentPeople(canvas);

        if (!segmentation || segmentation.length === 0) return null;

        const maskData = await segmentation[0].mask.toImageData();
        // Convert RGBA mask to binary (just use alpha or red channel)
        const binary = new Uint8Array(maskData.width * maskData.height);
        for (let i = 0; i < binary.length; i++) {
          binary[i] = maskData.data[i * 4] > 128 ? 255 : 0;
        }

        return binary;
      } catch (err) {
        console.error('Segmentation error:', err);
        return null;
      }
    },
    [loadModel]
  );

  return { isLoading, error, segment };
}
