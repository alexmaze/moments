import { relations } from 'drizzle-orm';
import { users } from './users';
import { mediaAssets } from './media';
import { posts, postMediaRelations, postLikes, postComments } from './posts';
import { spaces, spaceMembers, growthRecords } from './spaces';
import { tags, postTags } from './tags';
import { mentions } from './mentions';
import { notifications, notificationActors } from './notifications';

export const usersRelations = relations(users, ({ one, many }) => ({
  posts: many(posts),
  comments: many(postComments),
  likes: many(postLikes),
  media: many(mediaAssets),
  avatarMedia: one(mediaAssets, { fields: [users.avatarMediaId], references: [mediaAssets.id] }),
  spaceMembers: many(spaceMembers),
  createdSpaces: many(spaces),
  mentionsMade: many(mentions, { relationName: 'mentioner' }),
  mentionsReceived: many(mentions, { relationName: 'mentionedUser' }),
  notificationsReceived: many(notifications, { relationName: 'notificationRecipient' }),
  notificationLatestActor: many(notifications, { relationName: 'notificationLatestActor' }),
  notificationActors: many(notificationActors, { relationName: 'notificationActor' }),
}));

export const postsRelations = relations(posts, ({ one, many }) => ({
  author: one(users, { fields: [posts.authorId], references: [users.id] }),
  space: one(spaces, { fields: [posts.spaceId], references: [spaces.id] }),
  mediaRelations: many(postMediaRelations),
  likes: many(postLikes),
  comments: many(postComments),
  postTags: many(postTags),
}));

export const postMediaRelationsRelations = relations(postMediaRelations, ({ one }) => ({
  post: one(posts, { fields: [postMediaRelations.postId], references: [posts.id] }),
  media: one(mediaAssets, { fields: [postMediaRelations.mediaId], references: [mediaAssets.id] }),
}));

export const mediaAssetsRelations = relations(mediaAssets, ({ one, many }) => ({
  uploader: one(users, { fields: [mediaAssets.uploaderId], references: [users.id] }),
  attachedPosts: many(postMediaRelations),
  avatarUsers: many(users),
  coverSpaces: many(spaces),
}));

export const postLikesRelations = relations(postLikes, ({ one }) => ({
  post: one(posts, { fields: [postLikes.postId], references: [posts.id] }),
  user: one(users, { fields: [postLikes.userId], references: [users.id] }),
}));

export const postCommentsRelations = relations(postComments, ({ one, many }) => ({
  post: one(posts, { fields: [postComments.postId], references: [posts.id] }),
  author: one(users, { fields: [postComments.authorId], references: [users.id] }),
  replyTo: one(postComments, {
    fields: [postComments.replyToId],
    references: [postComments.id],
    relationName: 'replies',
  }),
  replies: many(postComments, { relationName: 'replies' }),
}));

export const spacesRelations = relations(spaces, ({ one, many }) => ({
  creator: one(users, { fields: [spaces.creatorId], references: [users.id] }),
  coverMedia: one(mediaAssets, { fields: [spaces.coverMediaId], references: [mediaAssets.id] }),
  members: many(spaceMembers),
  posts: many(posts),
  growthRecords: many(growthRecords),
}));

export const spaceMembersRelations = relations(spaceMembers, ({ one }) => ({
  space: one(spaces, { fields: [spaceMembers.spaceId], references: [spaces.id] }),
  user: one(users, { fields: [spaceMembers.userId], references: [users.id] }),
}));

export const growthRecordsRelations = relations(growthRecords, ({ one }) => ({
  space: one(spaces, { fields: [growthRecords.spaceId], references: [spaces.id] }),
  recorder: one(users, { fields: [growthRecords.recordedBy], references: [users.id] }),
}));

export const tagsRelations = relations(tags, ({ many }) => ({
  postTags: many(postTags),
}));

export const postTagsRelations = relations(postTags, ({ one }) => ({
  post: one(posts, { fields: [postTags.postId], references: [posts.id] }),
  tag: one(tags, { fields: [postTags.tagId], references: [tags.id] }),
}));

export const mentionsRelations = relations(mentions, ({ one }) => ({
  mentioner: one(users, {
    fields: [mentions.mentionerId],
    references: [users.id],
    relationName: 'mentioner',
  }),
  mentionedUser: one(users, {
    fields: [mentions.mentionedUserId],
    references: [users.id],
    relationName: 'mentionedUser',
  }),
}));

export const notificationsRelations = relations(notifications, ({ one, many }) => ({
  recipient: one(users, {
    fields: [notifications.recipientId],
    references: [users.id],
    relationName: 'notificationRecipient',
  }),
  latestActor: one(users, {
    fields: [notifications.latestActorId],
    references: [users.id],
    relationName: 'notificationLatestActor',
  }),
  post: one(posts, {
    fields: [notifications.postId],
    references: [posts.id],
  }),
  comment: one(postComments, {
    fields: [notifications.commentId],
    references: [postComments.id],
  }),
  replyToComment: one(postComments, {
    fields: [notifications.replyToCommentId],
    references: [postComments.id],
    relationName: 'notificationReplyToComment',
  }),
  actors: many(notificationActors),
}));

export const notificationActorsRelations = relations(notificationActors, ({ one }) => ({
  notification: one(notifications, {
    fields: [notificationActors.notificationId],
    references: [notifications.id],
  }),
  actor: one(users, {
    fields: [notificationActors.actorId],
    references: [users.id],
    relationName: 'notificationActor',
  }),
}));
