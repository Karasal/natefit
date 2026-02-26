'use client';

import { motion } from 'framer-motion';
import { Scan, Activity, Cpu } from 'lucide-react';

interface ProcessingViewProps {
  progress: number;
  error?: string | null;
}

const stages = [
  { min: 0, max: 25, label: 'Segmenting body...', icon: Scan },
  { min: 25, max: 50, label: 'Analyzing silhouette...', icon: Activity },
  { min: 50, max: 80, label: 'Calculating measurements...', icon: Cpu },
  { min: 80, max: 100, label: 'Computing body composition...', icon: Activity },
];

export function ProcessingView({ progress, error }: ProcessingViewProps) {
  const currentStage = stages.find((s) => progress >= s.min && progress < s.max) || stages[stages.length - 1];
  const Icon = currentStage.icon;

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-danger/10 flex items-center justify-center mb-4">
          <Activity className="h-8 w-8 text-danger" />
        </div>
        <h3 className="font-display text-xl font-bold mb-2">Processing Failed</h3>
        <p className="text-sm text-text-muted max-w-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-6">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
        className="w-20 h-20 rounded-full border-2 border-neon/20 border-t-neon flex items-center justify-center mb-6"
      >
        <Icon className="h-8 w-8 text-neon" />
      </motion.div>

      <h3 className="font-display text-xl font-bold mb-2">Processing Scan</h3>
      <p className="text-sm text-text-muted mb-6">{currentStage.label}</p>

      {/* Progress bar */}
      <div className="w-64 h-2 bg-white/5 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-neon rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>
      <p className="text-xs text-text-dim mt-2 font-mono">{progress}%</p>
    </div>
  );
}
