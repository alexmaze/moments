import { z } from 'zod';

export const loginSchema = z.object({
  username: z.string().min(2).max(50),
  password: z.string().min(6).max(128),
});

export const registerSchema = z.object({
  username: z.string().min(2).max(50).regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores and hyphens'),
  displayName: z.string().min(1).max(100),
  password: z.string().min(6).max(128),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
