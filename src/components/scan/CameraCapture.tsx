'use client';

import { useEffect, useRef, useState } from 'react';
import { useCamera } from '@/hooks/useCamera';
import { usePoseDetection } from '@/hooks/usePoseDetection';
import { validateFrontPose, validateSidePose, calculateStability } from '@/lib/scan/pose-validator';
import { STABLE_FRAMES_REQUIRED } from '@/lib/scan/constants';
import type { PoseKeypoints } from '@/lib/types';
import { Camera, AlertCircle, CheckCircle } from 'lucide-react';

interface CameraCaptureProps {
  mode: 'front' | 'side';
  onCapture: (blob: Blob, keypoints: PoseKeypoints, imageData: ImageData) => void;
  onBack?: () => void;
}

export function CameraCapture({ mode, onCapture, onBack }: CameraCaptureProps) {
  const { videoRef, canvasRef, isReady, error: cameraError, startCamera, stopCamera, captureFrame, captureBlob } = useCamera();
  const { keypoints, isLoading: poseLoading, isDetecting, error: poseError, startDetection, stopDetection } = usePoseDetection();

  const [validationIssues, setValidationIssues] = useState<string[]>([]);
  const [stableFrames, setStableFrames] = useState(0);
  const [isValid, setIsValid] = useState(false);
  const prevKeypointsRef = useRef<PoseKeypoints | null>(null);
  const capturedRef = useRef(false);

  // Start camera on mount
  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, []);

  // Start pose detection when camera is ready
  useEffect(() => {
    if (isReady && videoRef.current) {
      startDetection(videoRef.current);
    }
    return () => stopDetection();
  }, [isReady]);

  // Validate pose on each frame
  useEffect(() => {
    if (!keypoints || !videoRef.current) return;

    const video = videoRef.current;
    const validate = mode === 'front' ? validateFrontPose : validateSidePose;
    const result = validate(keypoints, video.videoWidth, video.videoHeight);

    setValidationIssues(result.issues);
    setIsValid(result.valid);

    // Calculate stability
    if (prevKeypointsRef.current && result.valid) {
      const stability = calculateStability(
        keypoints,
        prevKeypointsRef.current,
        video.videoWidth,
        video.videoHeight
      );
      if (stability > 0.8) {
        setStableFrames((prev) => prev + 1);
      } else {
        setStableFrames(0);
      }
    }

    prevKeypointsRef.current = keypoints;
  }, [keypoints, mode]);

  // Auto-capture when stable enough
  useEffect(() => {
    if (stableFrames >= STABLE_FRAMES_REQUIRED && !capturedRef.current && keypoints) {
      capturedRef.current = true;
      handleCapture();
    }
  }, [stableFrames, keypoints]);

  const handleCapture = async () => {
    if (!keypoints) return;

    const imageData = captureFrame();
    const blob = await captureBlob();

    if (blob && imageData) {
      stopDetection();
      stopCamera();
      onCapture(blob, keypoints, imageData);
    }
  };

  const stabilityPct = Math.min(100, Math.round((stableFrames / STABLE_FRAMES_REQUIRED) * 100));

  const errorMessage = cameraError || poseError;

  if (errorMessage) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
        <AlertCircle className="h-12 w-12 text-danger mb-4" />
        <p className="text-text mb-2">{errorMessage}</p>
        <button
          onClick={startCamera}
          className="text-neon underline text-sm"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="relative w-full max-w-md mx-auto">
      {/* Camera feed */}
      <div className="relative aspect-[9/16] bg-black rounded-2xl overflow-hidden">
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover"
          playsInline
          muted
        />
        <canvas ref={canvasRef} className="hidden" />

        {/* Pose guide overlay */}
        {isReady && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <svg
              viewBox="0 0 200 400"
              className={`w-1/2 h-3/4 transition-opacity duration-300 ${
                isValid ? 'opacity-30' : 'opacity-60'
              }`}
            >
              {mode === 'front' ? (
                // Front A-pose silhouette
                <path
                  d="M100,30 C88,30 80,40 80,52 L80,55 C80,60 85,65 90,65 L110,65 C115,65 120,60 120,55 L120,52 C120,40 112,30 100,30 Z M70,68 L55,130 L40,130 L30,190 L50,190 L55,155 L65,155 L75,200 L85,260 L80,350 L95,350 L100,270 L105,350 L120,350 L115,260 L125,200 L135,155 L145,155 L150,190 L170,190 L160,130 L145,130 L130,68 Z"
                  fill="none"
                  stroke={isValid ? '#00FF87' : '#ffffff'}
                  strokeWidth="1.5"
                  strokeDasharray="4 3"
                />
              ) : (
                // Side profile silhouette
                <path
                  d="M105,30 C95,30 90,38 90,50 L90,55 C90,60 93,65 98,65 L112,65 C117,65 120,60 120,55 L120,50 C120,38 115,30 105,30 Z M95,68 L85,120 L85,190 L95,260 L90,350 L105,350 L110,260 L115,190 L115,120 L110,68 Z"
                  fill="none"
                  stroke={isValid ? '#00FF87' : '#ffffff'}
                  strokeWidth="1.5"
                  strokeDasharray="4 3"
                />
              )}
            </svg>
          </div>
        )}

        {/* Status bar */}
        <div className="absolute top-0 left-0 right-0 p-4">
          <div className="glass rounded-lg px-3 py-2 flex items-center gap-2">
            {poseLoading ? (
              <>
                <div className="w-2 h-2 rounded-full bg-hot animate-pulse" />
                <span className="text-xs text-text-muted">Loading pose model...</span>
              </>
            ) : isValid ? (
              <>
                <CheckCircle className="h-4 w-4 text-neon" />
                <span className="text-xs text-neon">Hold still...</span>
              </>
            ) : (
              <>
                <Camera className="h-4 w-4 text-text-muted" />
                <span className="text-xs text-text-muted">
                  {mode === 'front' ? 'Front view' : 'Side view'}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Validation messages */}
        {validationIssues.length > 0 && (
          <div className="absolute bottom-20 left-4 right-4">
            <div className="glass rounded-lg px-3 py-2">
              {validationIssues.map((issue, i) => (
                <p key={i} className="text-xs text-hot">{issue}</p>
              ))}
            </div>
          </div>
        )}

        {/* Stability progress */}
        {isValid && stableFrames > 0 && (
          <div className="absolute bottom-4 left-4 right-4">
            <div className="h-1 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-neon transition-all duration-100 rounded-full"
                style={{ width: `${stabilityPct}%` }}
              />
            </div>
            <p className="text-center text-xs text-text-muted mt-1">
              Auto-capture: {stabilityPct}%
            </p>
          </div>
        )}
      </div>

      {/* Manual capture button */}
      <div className="flex justify-center mt-4 gap-3">
        {onBack && (
          <button
            onClick={onBack}
            className="px-4 py-2 text-sm text-text-muted hover:text-text"
          >
            Back
          </button>
        )}
        <button
          onClick={handleCapture}
          disabled={!keypoints}
          className="w-16 h-16 rounded-full border-4 border-neon/50 bg-neon/10 hover:bg-neon/20 disabled:opacity-30 disabled:border-white/20 transition-all flex items-center justify-center"
        >
          <div className="w-12 h-12 rounded-full bg-neon/80" />
        </button>
      </div>
    </div>
  );
}
