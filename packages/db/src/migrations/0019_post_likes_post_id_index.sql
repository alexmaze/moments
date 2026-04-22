-- Add index on post_likes(post_id) for efficient liked users queries
CREATE INDEX IF NOT EXISTS idx_post_likes_post ON post_likes(post_id);
