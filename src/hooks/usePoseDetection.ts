'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { PoseKeypoints } from '@/lib/types';

interface UsePoseDetectionReturn {
  keypoints: PoseKeypoints | null;
  isLoading: boolean;
  isDetecting: boolean;
  error: string | null;
  startDetection: (video: HTMLVideoElement) => void;
  stopDetection: () => void;
}

/**
 * MediaPipe Pose Landmarker via @mediapipe/tasks-vision.
 * Runs real-time on camera feed, returns 33 3D keypoints.
 */
export function usePoseDetection(): UsePoseDetectionReturn {
  const [keypoints, setKeypoints] = useState<PoseKeypoints | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const landmarkerRef = useRef<any>(null);
  const rafRef = useRef<number>(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const loadModel = useCallback(async () => {
    if (landmarkerRef.current) return;

    setIsLoading(true);
    try {
      const vision = await import('@mediapipe/tasks-vision');
      const { PoseLandmarker, FilesetResolver } = vision;

      const filesetResolver = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
      );

      landmarkerRef.current = await PoseLandmarker.createFromOptions(filesetResolver, {
        baseOptions: {
          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/1/pose_landmarker_heavy.task',
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numPoses: 1,
      });

      setIsLoading(false);
    } catch (err) {
      setError('Failed to load pose detection model');
      setIsLoading(false);
    }
  }, []);

  const detect = useCallback(() => {
    const video = videoRef.current;
    const landmarker = landmarkerRef.current;

    if (!video || !landmarker || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(detect);
      return;
    }

    const result = landmarker.detectForVideo(video, performance.now());

    if (result.landmarks && result.landmarks.length > 0) {
      const landmarks = result.landmarks[0];
      const worldLandmarks = result.worldLandmarks?.[0];

      const mapped: PoseKeypoints = landmarks.map((lm: any, i: number) => ({
        x: lm.x,
        y: lm.y,
        z: worldLandmarks?.[i]?.z ?? lm.z ?? 0,
        visibility: lm.visibility ?? 1,
        name: `landmark_${i}`,
      }));

      setKeypoints(mapped);
    } else {
      setKeypoints(null);
    }

    rafRef.current = requestAnimationFrame(detect);
  }, []);

  const startDetection = useCallback(
    async (video: HTMLVideoElement) => {
      videoRef.current = video;
      await loadModel();
      setIsDetecting(true);
      rafRef.current = requestAnimationFrame(detect);
    },
    [loadModel, detect]
  );

  const stopDetection = useCallback(() => {
    setIsDetecting(false);
    cancelAnimationFrame(rafRef.current);
    setKeypoints(null);
  }, []);

  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current);
      if (landmarkerRef.current) {
        landmarkerRef.current.close();
        landmarkerRef.current = null;
      }
    };
  }, []);

  return {
    keypoints,
    isLoading,
    isDetecting,
    error,
    startDetection,
    stopDetection,
  };
}
