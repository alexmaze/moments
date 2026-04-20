import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq, and, count } from 'drizzle-orm';
import { DRIZZLE } from '../../database/database.module';
import { type DrizzleClient, users, posts } from '@moments/db';
import { UpdateProfileDto } from './dto';

@Injectable()
export class UsersService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleClient,
  ) {}

  async getProfile(username: string) {
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.username, username))
      .limit(1);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const [postCountResult] = await this.db
      .select({ count: count() })
      .from(posts)
      .where(and(eq(posts.authorId, user.id), eq(posts.isDeleted, false)));

    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      locale: user.locale,
      theme: user.theme,
      background: user.background,
      postCount: postCountResult.count,
      createdAt: user.createdAt.toISOString(),
    };
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
      avatarUrl: updated.avatarUrl,
      bio: updated.bio,
      locale: updated.locale,
      theme: updated.theme,
      background: updated.background,
      createdAt: updated.createdAt.toISOString(),
    };
  }

  async updateAvatar(userId: string, avatarUrl: string) {
    const [updated] = await this.db
      .update(users)
      .set({ avatarUrl, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();

    return {
      id: updated.id,
      username: updated.username,
      displayName: updated.displayName,
      avatarUrl: updated.avatarUrl,
      bio: updated.bio,
      locale: updated.locale,
      theme: updated.theme,
      background: updated.background,
      createdAt: updated.createdAt.toISOString(),
    };
  }
}
