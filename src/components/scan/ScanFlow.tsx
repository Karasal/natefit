'use client';

import { useState, useCallback } from 'react';
import type { ScanStep, ScanFlowState, CalibrationData, PoseKeypoints } from '@/lib/types';
import { CalibrationStep } from './CalibrationStep';
import { CameraCapture } from './CameraCapture';
import { ProcessingView } from './ProcessingView';
import { ScanResults } from './ScanResults';
import { useScanProcessor } from '@/hooks/useScanProcessor';
import { Button } from '@/components/ui/Button';
import { ArrowRight, Camera, Scan } from 'lucide-react';

interface ScanFlowProps {
  clientId?: string;
  onComplete?: (result: ScanFlowState) => void;
}

export function ScanFlow({ clientId, onComplete }: ScanFlowProps) {
  const [state, setState] = useState<ScanFlowState>({
    step: 'intro',
    calibration: null,
    frontImage: null,
    frontKeypoints: null,
    sideImage: null,
    sideKeypoints: null,
    result: null,
    error: null,
  });

  const { isProcessing, progress, error: processingError, process } = useScanProcessor();

  const setStep = (step: ScanStep) => setState((prev) => ({ ...prev, step }));

  const handleCalibration = useCallback(
    (data: Omit<CalibrationData, 'pixels_per_cm' | 'image_width' | 'image_height'>) => {
      setState((prev) => ({
        ...prev,
        calibration: { ...data },
        step: 'front_capture',
      }));
    },
    []
  );

  const handleFrontCapture = useCallback(
    (blob: Blob, keypoints: PoseKeypoints, _imageData: ImageData) => {
      setState((prev) => ({
        ...prev,
        frontImage: blob,
        frontKeypoints: keypoints,
        step: 'front_review',
      }));
    },
    []
  );

  const handleSideCapture = useCallback(
    (blob: Blob, keypoints: PoseKeypoints, _imageData: ImageData) => {
      setState((prev) => ({
        ...prev,
        sideImage: blob,
        sideKeypoints: keypoints,
        step: 'side_review',
      }));
    },
    []
  );

  const handleProcess = useCallback(async () => {
    setStep('processing');

    if (!state.frontImage || !state.sideImage || !state.calibration) {
      setState((prev) => ({ ...prev, error: 'Missing scan data' }));
      return;
    }

    const result = await process(
      state.frontImage,
      state.sideImage,
      state.calibration
    );

    if (result) {
      setState((prev) => ({ ...prev, result, step: 'results' }));
      onComplete?.({ ...state, result });
    }
  }, [state, process, onComplete]);

  switch (state.step) {
    case 'intro':
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
          <div className="w-20 h-20 rounded-2xl bg-neon/10 flex items-center justify-center mb-6">
            <Scan className="h-10 w-10 text-neon" />
          </div>
          <h2 className="font-display text-3xl font-bold mb-3">Body Scan</h2>
          <p className="text-text-muted max-w-sm mb-2">
            Take two photos — front and side — and we&apos;ll calculate your body measurements in seconds.
          </p>
          <ul className="text-sm text-text-dim space-y-1 mb-8">
            <li>Wear fitted clothing</li>
            <li>Stand against a plain background</li>
            <li>Ensure good lighting</li>
          </ul>
          <Button onClick={() => setStep('calibration')} icon={<ArrowRight className="h-4 w-4" />}>
            Start Scan
          </Button>
        </div>
      );

    case 'calibration':
      return <CalibrationStep onComplete={handleCalibration} onBack={() => setStep('intro')} />;

    case 'front_capture':
      return <CameraCapture mode="front" onCapture={handleFrontCapture} onBack={() => setStep('calibration')} />;

    case 'front_review':
      return (
        <div className="flex flex-col items-center p-6">
          <h3 className="font-display text-xl font-bold mb-4">Front Photo</h3>
          {state.frontImage && (
            <div className="w-64 aspect-[9/16] rounded-xl overflow-hidden mb-4 bg-surface">
              <img
                src={URL.createObjectURL(state.frontImage)}
                alt="Front view"
                className="w-full h-full object-cover"
              />
            </div>
          )}
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setStep('front_capture')}>
              Retake
            </Button>
            <Button onClick={() => setStep('side_capture')} icon={<Camera className="h-4 w-4" />}>
              Take Side Photo
            </Button>
          </div>
        </div>
      );

    case 'side_capture':
      return <CameraCapture mode="side" onCapture={handleSideCapture} onBack={() => setStep('front_review')} />;

    case 'side_review':
      return (
        <div className="flex flex-col items-center p-6">
          <h3 className="font-display text-xl font-bold mb-4">Side Photo</h3>
          {state.sideImage && (
            <div className="w-64 aspect-[9/16] rounded-xl overflow-hidden mb-4 bg-surface">
              <img
                src={URL.createObjectURL(state.sideImage)}
                alt="Side view"
                className="w-full h-full object-cover"
              />
            </div>
          )}
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setStep('side_capture')}>
              Retake
            </Button>
            <Button onClick={handleProcess} icon={<Scan className="h-4 w-4" />}>
              Process Scan
            </Button>
          </div>
        </div>
      );

    case 'processing':
      return <ProcessingView progress={progress} error={processingError || state.error} />;

    case 'results':
      return state.result ? (
        <ScanResults result={state.result} calibration={state.calibration!} />
      ) : null;

    default:
      return null;
  }
}
