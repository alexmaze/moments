import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq, and, count, ilike, or, inArray } from 'drizzle-orm';
import { DRIZZLE } from '../../database/database.module';
import { type DrizzleClient, mediaAssets, posts, users } from '@moments/db';
import { UpdateProfileDto } from './dto';
import { MediaService } from '../media/media.service';

@Injectable()
export class UsersService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleClient,
    private readonly mediaService: MediaService,
  ) {}

  async getProfile(username: string) {
    const [user] = await this.db
      .select({
        user: users,
        avatarPath: mediaAssets.storagePath,
      })
      .from(users)
      .leftJoin(mediaAssets, eq(users.avatarMediaId, mediaAssets.id))
      .where(eq(users.username, username))
      .limit(1);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const [postCountResult] = await this.db
      .select({ count: count() })
      .from(posts)
      .where(and(eq(posts.authorId, user.user.id), eq(posts.isDeleted, false)));

    return {
      id: user.user.id,
      username: user.user.username,
      displayName: user.user.displayName,
      avatarUrl: user.avatarPath ? await this.mediaService.getSignedUrl(user.avatarPath) : null,
      bio: user.user.bio,
      locale: user.user.locale,
      theme: user.user.theme,
      background: user.user.background,
      postCount: postCountResult.count,
      createdAt: user.user.createdAt.toISOString(),
    };
  }

  async search(query: string, limit = 10) {
    const searchTerm = `%${query}%`;
    
    const rows = await this.db
      .select({
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        avatarPath: mediaAssets.storagePath,
      })
      .from(users)
      .leftJoin(mediaAssets, eq(users.avatarMediaId, mediaAssets.id))
      .where(or(
        ilike(users.username, searchTerm),
        ilike(users.displayName, searchTerm),
      ))
      .limit(limit);

    return this.mediaService.signUserAvatarRows(rows, this.mediaService.avatarCiParams);
  }

  async findByIds(ids: string[]) {
    if (ids.length === 0) return [];

    const joinedRows = await this.db
      .select({
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        avatarPath: mediaAssets.storagePath,
      })
      .from(users)
      .leftJoin(mediaAssets, eq(users.avatarMediaId, mediaAssets.id))
      .where(inArray(users.id, ids));

    return this.mediaService.signUserAvatarRows(joinedRows, this.mediaService.avatarCiParams);
  }

  async updateMe(userId: string, dto: UpdateProfileDto) {
    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (dto.displayName !== undefined) updateData.displayName = dto.displayName;
    if (dto.bio !== undefined) updateData.bio = dto.bio;
    if (dto.locale !== undefined) updateData.locale = dto.locale;
    if (dto.theme !== undefined) updateData.theme = dto.theme;
    if (dto.background !== undefined) updateData.background = dto.background;

    const [updated] = await this.db
      .update(users)
      .set(updateData)
      .where(eq(users.id, userId))
      .returning();

    return {
      id: updated.id,
      username: updated.username,
      displayName: updated.displayName,
      avatarUrl: await this.mediaService.signMediaAssetUrl(updated.avatarMediaId, this.mediaService.avatarCiParams),
      bio: updated.bio,
      locale: updated.locale,
      theme: updated.theme,
      background: updated.background,
      createdAt: updated.createdAt.toISOString(),
    };
  }

  async updateAvatar(userId: string, avatarMediaId: string) {
    const asset = await this.mediaService.requireOwnedPendingAsset(avatarMediaId, userId, 'image');

    const updated = await this.db.transaction(async (tx) => {
      const [current] = await tx
        .select({ avatarMediaId: users.avatarMediaId })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      const [nextUser] = await tx
        .update(users)
        .set({
          avatarMediaId: asset.id,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId))
        .returning();

      await this.mediaService.attachAsset(asset.id, 'user_avatar', tx);

      if (current?.avatarMediaId && current.avatarMediaId !== asset.id) {
        await this.mediaService.markOrphanedIfUnreferenced(current.avatarMediaId, tx);
      }

      return nextUser;
    });

    return {
      id: updated.id,
      username: updated.username,
      displayName: updated.displayName,
      avatarUrl: await this.mediaService.getSignedUrl(asset.storagePath),
      bio: updated.bio,
      locale: updated.locale,
      theme: updated.theme,
      background: updated.background,
      createdAt: updated.createdAt.toISOString(),
    };
  }

}
