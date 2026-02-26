import type { BodyCompositionResult, Sex } from '@/lib/types';

/**
 * U.S. Navy body fat formula.
 * Male:   %BF = 86.010 × log10(waist - neck) - 70.041 × log10(height) + 36.76
 * Female: %BF = 163.205 × log10(waist + hip - neck) - 97.684 × log10(height) - 78.387
 */
export function navyBodyFat(
  sex: Sex,
  waist_cm: number,
  neck_cm: number,
  hip_cm: number,
  height_cm: number
): number {
  if (sex === 'male') {
    const diff = waist_cm - neck_cm;
    if (diff <= 0) return 5; // Floor to avoid log of non-positive
    return 86.010 * Math.log10(diff) - 70.041 * Math.log10(height_cm) + 36.76;
  } else {
    const sum = waist_cm + hip_cm - neck_cm;
    if (sum <= 0) return 10;
    return 163.205 * Math.log10(sum) - 97.684 * Math.log10(height_cm) - 78.387;
  }
}

/**
 * CUN-BAE formula (Clínica Universidad de Navarra - Body Adiposity Estimator).
 * Uses BMI, age, and sex. Validated against DEXA with R² = 0.87.
 *
 * BF% = -44.988 + (0.503 × age) + (10.689 × sex) + (3.172 × BMI)
 *        - (0.026 × BMI²) + (0.181 × BMI × sex) - (0.02 × BMI × age)
 *        - (0.005 × BMI² × sex) + (0.00021 × BMI² × age)
 *
 * Where sex: female = 1, male = 0
 */
export function cunbaeBodyFat(bmi: number, age: number, sex: Sex): number {
  const s = sex === 'female' ? 1 : 0;
  return (
    -44.988 +
    0.503 * age +
    10.689 * s +
    3.172 * bmi -
    0.026 * bmi * bmi +
    0.181 * bmi * s -
    0.02 * bmi * age -
    0.005 * bmi * bmi * s +
    0.00021 * bmi * bmi * age
  );
}

/**
 * Calculate BMI from height (cm) and weight (kg).
 */
export function calculateBMI(height_cm: number, weight_kg: number): number {
  const height_m = height_cm / 100;
  return weight_kg / (height_m * height_m);
}

/**
 * Full body composition pipeline.
 * Uses ensemble: 60% Navy (dimension-based) + 40% CUN-BAE (anthropometric).
 */
export function calculateBodyComposition(
  sex: Sex,
  age: number,
  height_cm: number,
  weight_kg: number,
  waist_cm: number,
  neck_cm: number,
  hip_cm: number
): BodyCompositionResult {
  const bmi = calculateBMI(height_cm, weight_kg);
  const navy = navyBodyFat(sex, waist_cm, neck_cm, hip_cm, height_cm);
  const cunbae = cunbaeBodyFat(bmi, age, sex);

  // Clamp individual estimates to reasonable range
  const navyClamped = Math.max(3, Math.min(60, navy));
  const cunbaeClamped = Math.max(3, Math.min(60, cunbae));

  // Ensemble: 60% Navy (uses actual body dimensions) + 40% CUN-BAE
  const bodyFatPct = navyClamped * 0.6 + cunbaeClamped * 0.4;

  const fatMassKg = (bodyFatPct / 100) * weight_kg;
  const leanMassKg = weight_kg - fatMassKg;
  const waistHipRatio = waist_cm / hip_cm;

  return {
    body_fat_pct: Math.round(bodyFatPct * 10) / 10,
    body_fat_navy: Math.round(navyClamped * 10) / 10,
    body_fat_cunbae: Math.round(cunbaeClamped * 10) / 10,
    lean_mass_kg: Math.round(leanMassKg * 10) / 10,
    fat_mass_kg: Math.round(fatMassKg * 10) / 10,
    bmi: Math.round(bmi * 10) / 10,
    waist_hip_ratio: Math.round(waistHipRatio * 100) / 100,
  };
}
