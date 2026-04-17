import { relations } from 'drizzle-orm';
import { users } from './users';
import { mediaAssets } from './media';
import { posts, postMediaRelations, postLikes, postComments } from './posts';

export const usersRelations = relations(users, ({ many }) => ({
  posts: many(posts),
  comments: many(postComments),
  likes: many(postLikes),
  media: many(mediaAssets),
}));

export const postsRelations = relations(posts, ({ one, many }) => ({
  author: one(users, { fields: [posts.authorId], references: [users.id] }),
  mediaRelations: many(postMediaRelations),
  likes: many(postLikes),
  comments: many(postComments),
}));

export const postMediaRelationsRelations = relations(postMediaRelations, ({ one }) => ({
  post: one(posts, { fields: [postMediaRelations.postId], references: [posts.id] }),
  media: one(mediaAssets, { fields: [postMediaRelations.mediaId], references: [mediaAssets.id] }),
}));

export const mediaAssetsRelations = relations(mediaAssets, ({ one }) => ({
  uploader: one(users, { fields: [mediaAssets.uploaderId], references: [users.id] }),
}));

export const postLikesRelations = relations(postLikes, ({ one }) => ({
  post: one(posts, { fields: [postLikes.postId], references: [posts.id] }),
  user: one(users, { fields: [postLikes.userId], references: [users.id] }),
}));

export const postCommentsRelations = relations(postComments, ({ one }) => ({
  post: one(posts, { fields: [postComments.postId], references: [posts.id] }),
  author: one(users, { fields: [postComments.authorId], references: [users.id] }),
}));
