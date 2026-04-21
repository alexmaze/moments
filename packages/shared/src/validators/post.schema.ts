import { z } from 'zod';

const createPostAudioSchema = z.object({
  mediaId: z.string().uuid(),
  waveform: z.array(z.number().int().min(0).max(100)).min(1).max(64),
});

export const createPostSchema = z.object({
  content: z.string().max(5000).optional(),
  mediaIds: z.array(z.string().uuid()).optional(),
  spaceId: z.string().uuid().optional(),
  audio: createPostAudioSchema.optional(),
}).refine(
  (data) =>
    (data.content && data.content.trim().length > 0) ||
    (data.mediaIds && data.mediaIds.length > 0) ||
    !!data.audio,
  { message: 'Post must have either text content, audio, or at least one media attachment' }
);

export const createCommentSchema = z.object({
  content: z.string().min(1).max(500),
});

export type CreatePostInput = z.infer<typeof createPostSchema>;
export type CreateCommentInput = z.infer<typeof createCommentSchema>;
