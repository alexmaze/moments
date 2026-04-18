import { z } from 'zod';

export const createPostSchema = z.object({
  content: z.string().max(5000).optional(),
  mediaIds: z.array(z.string().uuid()).optional(),
  spaceId: z.string().uuid().optional(),
}).refine(
  (data) => (data.content && data.content.trim().length > 0) || (data.mediaIds && data.mediaIds.length > 0),
  { message: 'Post must have either text content or at least one media attachment' }
);

export const createCommentSchema = z.object({
  content: z.string().min(1).max(500),
});

export type CreatePostInput = z.infer<typeof createPostSchema>;
export type CreateCommentInput = z.infer<typeof createCommentSchema>;
