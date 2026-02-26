import { z } from 'zod';

export const calibrationSchema = z.object({
  height_cm: z.number().min(100).max(250),
  weight_kg: z.number().min(30).max(300),
  age: z.number().int().min(13).max(120),
  sex: z.enum(['male', 'female']),
});

export const profileSchema = z.object({
  full_name: z.string().min(1).max(100),
  sex: z.enum(['male', 'female']).optional(),
  height_cm: z.number().min(100).max(250).optional(),
  date_of_birth: z.string().optional(),
});

export const clientSchema = z.object({
  email: z.string().email(),
  full_name: z.string().min(1).max(100),
  tags: z.array(z.string()).optional(),
  notes: z.string().max(1000).optional(),
});

export const goalSchema = z.object({
  metric: z.string().min(1),
  target_value: z.number(),
  direction: z.enum(['increase', 'decrease', 'maintain']),
  deadline: z.string().optional(),
});

export function validateEmail(email: string): boolean {
  return z.string().email().safeParse(email).success;
}

export function validateHeight(cm: number): boolean {
  return cm >= 100 && cm <= 250;
}

export function validateWeight(kg: number): boolean {
  return kg >= 30 && kg <= 300;
}
