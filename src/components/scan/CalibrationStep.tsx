'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import type { CalibrationData, Sex } from '@/lib/types';
import { Ruler, Weight, Calendar, User } from 'lucide-react';

interface CalibrationStepProps {
  onComplete: (data: Omit<CalibrationData, 'pixels_per_cm' | 'image_width' | 'image_height'>) => void;
  onBack?: () => void;
  initialData?: Partial<CalibrationData>;
}

export function CalibrationStep({ onComplete, onBack, initialData }: CalibrationStepProps) {
  const [heightCm, setHeightCm] = useState(initialData?.height_cm?.toString() || '');
  const [weightKg, setWeightKg] = useState(initialData?.weight_kg?.toString() || '');
  const [age, setAge] = useState(initialData?.age?.toString() || '');
  const [sex, setSex] = useState<Sex>(initialData?.sex || 'male');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    const h = parseFloat(heightCm);
    if (!h || h < 100 || h > 250) newErrors.height = 'Enter height between 100-250 cm';

    const w = parseFloat(weightKg);
    if (!w || w < 30 || w > 300) newErrors.weight = 'Enter weight between 30-300 kg';

    const a = parseInt(age);
    if (!a || a < 13 || a > 120) newErrors.age = 'Enter age between 13-120';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    onComplete({
      height_cm: parseFloat(heightCm),
      weight_kg: parseFloat(weightKg),
      age: parseInt(age),
      sex,
    });
  };

  return (
    <div className="max-w-md mx-auto p-6">
      <div className="text-center mb-8">
        <h2 className="font-display text-2xl font-bold text-text mb-2">Calibration</h2>
        <p className="text-sm text-text-muted">
          We need a few measurements to calibrate the scanner accurately.
        </p>
      </div>

      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <div className="mt-6 p-2 rounded-lg bg-neon/10">
            <Ruler className="h-5 w-5 text-neon" />
          </div>
          <div className="flex-1">
            <Input
              label="Height"
              type="number"
              value={heightCm}
              onChange={(e) => setHeightCm(e.target.value)}
              placeholder="175"
              suffix="cm"
              error={errors.height}
            />
          </div>
        </div>

        <div className="flex items-start gap-3">
          <div className="mt-6 p-2 rounded-lg bg-electric/10">
            <Weight className="h-5 w-5 text-electric" />
          </div>
          <div className="flex-1">
            <Input
              label="Weight"
              type="number"
              value={weightKg}
              onChange={(e) => setWeightKg(e.target.value)}
              placeholder="75"
              suffix="kg"
              error={errors.weight}
            />
          </div>
        </div>

        <div className="flex items-start gap-3">
          <div className="mt-6 p-2 rounded-lg bg-hot/10">
            <Calendar className="h-5 w-5 text-hot" />
          </div>
          <div className="flex-1">
            <Input
              label="Age"
              type="number"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              placeholder="30"
              error={errors.age}
            />
          </div>
        </div>

        <div className="flex items-start gap-3">
          <div className="mt-6 p-2 rounded-lg bg-white/5">
            <User className="h-5 w-5 text-text-muted" />
          </div>
          <div className="flex-1">
            <Select
              label="Biological Sex"
              value={sex}
              onChange={(e) => setSex(e.target.value as Sex)}
              options={[
                { value: 'male', label: 'Male' },
                { value: 'female', label: 'Female' },
              ]}
            />
          </div>
        </div>
      </div>

      <div className="flex gap-3 mt-8">
        {onBack && (
          <Button variant="ghost" onClick={onBack} className="flex-1">
            Back
          </Button>
        )}
        <Button onClick={handleSubmit} className="flex-1">
          Continue
        </Button>
      </div>

      <p className="text-xs text-text-dim text-center mt-4">
        Height is used to calibrate measurements. All data is encrypted and private.
      </p>
    </div>
  );
}
