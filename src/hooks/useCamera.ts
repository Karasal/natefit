'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface UseCameraOptions {
  facingMode?: 'user' | 'environment';
  width?: number;
  height?: number;
}

interface UseCameraReturn {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  stream: MediaStream | null;
  isReady: boolean;
  error: string | null;
  startCamera: () => Promise<void>;
  stopCamera: () => void;
  captureFrame: () => ImageData | null;
  captureBlob: () => Promise<Blob | null>;
}

export function useCamera(options: UseCameraOptions = {}): UseCameraReturn {
  const {
    facingMode = 'environment',
    width = 1920,
    height = 1080,
  } = options;

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startCamera = useCallback(async () => {
    try {
      setError(null);
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode,
          width: { ideal: width },
          height: { ideal: height },
        },
        audio: false,
      });

      setStream(mediaStream);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
        setIsReady(true);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Camera access failed';
      if (message.includes('NotAllowed') || message.includes('Permission')) {
        setError('Camera permission denied. Please allow camera access.');
      } else if (message.includes('NotFound')) {
        setError('No camera found on this device.');
      } else {
        setError(message);
      }
    }
  }, [facingMode, width, height]);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
      setIsReady(false);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, [stream]);

  const captureFrame = useCallback((): ImageData | null => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !isReady) return null;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0);
    return ctx.getImageData(0, 0, canvas.width, canvas.height);
  }, [isReady]);

  const captureBlob = useCallback(async (): Promise<Blob | null> => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !isReady) return null;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0);

    return new Promise((resolve) => {
      canvas.toBlob(
        (blob) => resolve(blob),
        'image/jpeg',
        0.92
      );
    });
  }, [isReady]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [stream]);

  return {
    videoRef,
    canvasRef,
    stream,
    isReady,
    error,
    startCamera,
    stopCamera,
    captureFrame,
    captureBlob,
  };
}
