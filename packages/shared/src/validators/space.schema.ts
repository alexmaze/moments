import { z } from 'zod';

export const createSpaceSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(2).max(100).regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    'Slug must contain only lowercase letters, numbers, and hyphens',
  ),
  description: z.string().max(500).optional(),
  type: z.enum(['general', 'baby']).default('general'),
});

export const updateSpaceSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  coverUrl: z.string().url().nullable().optional(),
  coverPositionY: z.number().min(0).max(100).optional(),
});

export const createGrowthRecordSchema = z.object({
  date: z.string(),
  heightCm: z.number().min(0).max(300).optional(),
  weightKg: z.number().min(0).max(200).optional(),
  headCircumferenceCm: z.number().min(0).max(100).optional(),
}).refine(
  (data) =>
    data.heightCm !== undefined ||
    data.weightKg !== undefined ||
    data.headCircumferenceCm !== undefined,
  { message: 'At least one measurement is required' },
);

export type CreateSpaceInput = z.infer<typeof createSpaceSchema>;
export type UpdateSpaceInput = z.infer<typeof updateSpaceSchema>;
export type CreateGrowthRecordInput = z.infer<typeof createGrowthRecordSchema>;
