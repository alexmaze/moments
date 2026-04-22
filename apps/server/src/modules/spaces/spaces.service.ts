import {
  Injectable,
  Inject,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { eq, and, desc, lt, inArray, sql } from 'drizzle-orm';
import { DRIZZLE } from '../../database/database.module';
import {
  type DrizzleClient,
  mediaAssets,
  spaces,
  spaceMembers,
  users,
} from '@moments/db';
import { CreateSpaceDto, UpdateSpaceDto } from './dto';
import { MediaService } from '../media/media.service';

@Injectable()
export class SpacesService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleClient,
    private readonly mediaService: MediaService,
  ) {}

  // ── Space CRUD ──

  async create(dto: CreateSpaceDto, userId: string) {
    // Check slug uniqueness
    const [existing] = await this.db
      .select({ id: spaces.id })
      .from(spaces)
      .where(eq(spaces.slug, dto.slug))
      .limit(1);

    if (existing) {
      throw new ConflictException('A space with this slug already exists');
    }

    const space = await this.db.transaction(async (tx) => {
      // Create space
      const [newSpace] = await tx.insert(spaces).values({
        name: dto.name,
        slug: dto.slug,
        description: dto.description ?? null,
        type: dto.type ?? 'general',
        creatorId: userId,
        memberCount: 1,
      }).returning();

      // Add creator as owner
      await tx.insert(spaceMembers).values({
        spaceId: newSpace.id,
        userId,
        role: 'owner',
      });

      return newSpace;
    });

    return this.getBySlug(space.slug, userId);
  }

  async getBySlug(slug: string, currentUserId?: string) {
    const [space] = await this.db
      .select()
      .from(spaces)
      .where(and(eq(spaces.slug, slug), eq(spaces.isDeleted, false)))
      .limit(1);

    if (!space) {
      throw new NotFoundException('Space not found');
    }

    // Load creator
    const [creator] = await this.db
      .select({
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: mediaAssets.publicUrl,
      })
      .from(users)
      .leftJoin(mediaAssets, eq(users.avatarMediaId, mediaAssets.id))
      .where(eq(users.id, space.creatorId))
      .limit(1);

    const coverUrl = await this.resolveCoverUrl(space.coverMediaId);

    // Check membership
    let myMembership: { role: 'owner' | 'admin' | 'member'; spaceNickname: string | null; joinedAt: string } | null = null;
    if (currentUserId) {
      const [membership] = await this.db
        .select({ role: spaceMembers.role, spaceNickname: spaceMembers.spaceNickname, joinedAt: spaceMembers.joinedAt })
        .from(spaceMembers)
        .where(and(
          eq(spaceMembers.spaceId, space.id),
          eq(spaceMembers.userId, currentUserId),
        ))
        .limit(1);

      if (membership) {
        myMembership = {
          role: membership.role,
          spaceNickname: membership.spaceNickname,
          joinedAt: membership.joinedAt.toISOString(),
        };
      }
    }

    return {
      id: space.id,
      name: space.name,
      slug: space.slug,
      description: space.description,
      coverMediaId: space.coverMediaId,
      coverUrl,
      coverPositionY: space.coverPositionY,
      type: space.type,
      creator,
      memberCount: space.memberCount,
      postCount: space.postCount,
      createdAt: space.createdAt.toISOString(),
      myMembership,
    };
  }

  async list(cursor?: string, limit = 20) {
    const safeLimit = Math.min(limit, 50);

    const conditions = [eq(spaces.isDeleted, false)];
    if (cursor) {
      conditions.push(lt(spaces.createdAt, new Date(cursor)));
    }

    const spaceRows = await this.db
      .select()
      .from(spaces)
      .where(and(...conditions))
      .orderBy(desc(spaces.createdAt))
      .limit(safeLimit + 1);

    const hasMore = spaceRows.length > safeLimit;
    const resultSpaces = hasMore ? spaceRows.slice(0, safeLimit) : spaceRows;

    if (resultSpaces.length === 0) {
      return { data: [], meta: { hasMore: false, nextCursor: null } };
    }

    // Batch load creators
    const creatorIds = [...new Set(resultSpaces.map((s) => s.creatorId))];
    const creatorRows = await this.db
      .select({
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: mediaAssets.publicUrl,
      })
      .from(users)
      .leftJoin(mediaAssets, eq(users.avatarMediaId, mediaAssets.id))
      .where(inArray(users.id, creatorIds));
    const creatorMap = new Map(creatorRows.map((c) => [c.id, c]));
    const coverUrlMap = await this.buildCoverUrlMap(resultSpaces.map((space) => space.coverMediaId));

    const data = resultSpaces.map((space) => ({
      id: space.id,
      name: space.name,
      slug: space.slug,
      description: space.description,
      coverMediaId: space.coverMediaId,
      coverUrl: coverUrlMap.get(space.coverMediaId ?? '') ?? null,
      coverPositionY: space.coverPositionY,
      type: space.type,
      creator: creatorMap.get(space.creatorId)!,
      memberCount: space.memberCount,
      postCount: space.postCount,
      createdAt: space.createdAt.toISOString(),
    }));

    const lastSpace = resultSpaces[resultSpaces.length - 1];
    return {
      data,
      meta: {
        hasMore,
        nextCursor: hasMore ? lastSpace.createdAt.toISOString() : null,
      },
    };
  }

  async listMySpaces(userId: string) {
    const rows = await this.db
      .select({
        space: spaces,
        joinedAt: spaceMembers.joinedAt,
      })
      .from(spaceMembers)
      .innerJoin(spaces, eq(spaceMembers.spaceId, spaces.id))
      .where(and(
        eq(spaceMembers.userId, userId),
        eq(spaces.isDeleted, false),
      ))
      .orderBy(desc(spaceMembers.joinedAt));

    if (rows.length === 0) return [];

    // Batch load creators
    const creatorIds = [...new Set(rows.map((r) => r.space.creatorId))];
    const creatorRows = await this.db
      .select({
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: mediaAssets.publicUrl,
      })
      .from(users)
      .leftJoin(mediaAssets, eq(users.avatarMediaId, mediaAssets.id))
      .where(inArray(users.id, creatorIds));
    const creatorMap = new Map(creatorRows.map((c) => [c.id, c]));
    const coverUrlMap = await this.buildCoverUrlMap(rows.map((row) => row.space.coverMediaId));

    return rows.map((r) => ({
      id: r.space.id,
      name: r.space.name,
      slug: r.space.slug,
      description: r.space.description,
      coverMediaId: r.space.coverMediaId,
      coverUrl: coverUrlMap.get(r.space.coverMediaId ?? '') ?? null,
      coverPositionY: r.space.coverPositionY,
      type: r.space.type,
      creator: creatorMap.get(r.space.creatorId)!,
      memberCount: r.space.memberCount,
      postCount: r.space.postCount,
      createdAt: r.space.createdAt.toISOString(),
    }));
  }

  async update(slug: string, dto: UpdateSpaceDto, userId: string) {
    const [space] = await this.db
      .select()
      .from(spaces)
      .where(and(eq(spaces.slug, slug), eq(spaces.isDeleted, false)))
      .limit(1);

    if (!space) {
      throw new NotFoundException('Space not found');
    }

    // Verify owner or admin
    const [membership] = await this.db
      .select({ role: spaceMembers.role })
      .from(spaceMembers)
      .where(and(
        eq(spaceMembers.spaceId, space.id),
        eq(spaceMembers.userId, userId),
      ))
      .limit(1);

    if (!membership || membership.role === 'member') {
      throw new ForbiddenException('Only space owner or admin can update the space');
    }

    await this.db.transaction(async (tx) => {
      const updateData: Record<string, unknown> = { updatedAt: new Date() };
      if (dto.name !== undefined) updateData.name = dto.name;
      if (dto.description !== undefined) updateData.description = dto.description;
      if (dto.coverPositionY !== undefined) updateData.coverPositionY = dto.coverPositionY;

      if (dto.coverMediaId !== undefined) {
        if (dto.coverMediaId === null) {
          updateData.coverMediaId = null;
        } else {
          const asset = await this.mediaService.requireOwnedPendingAsset(dto.coverMediaId, userId, 'image');
          updateData.coverMediaId = asset.id;
          await this.mediaService.attachAsset(asset.id, 'space_cover', tx);
        }
      }

      await tx
        .update(spaces)
        .set(updateData)
        .where(eq(spaces.id, space.id));

      if (dto.coverMediaId !== undefined && space.coverMediaId && space.coverMediaId !== dto.coverMediaId) {
        await this.mediaService.markOrphanedIfUnreferenced(space.coverMediaId, tx);
      }
    });

    return this.getBySlug(slug, userId);
  }

  async delete(slug: string, userId: string) {
    const [space] = await this.db
      .select()
      .from(spaces)
      .where(and(eq(spaces.slug, slug), eq(spaces.isDeleted, false)))
      .limit(1);

    if (!space) {
      throw new NotFoundException('Space not found');
    }

    // Only owner can delete
    const [membership] = await this.db
      .select({ role: spaceMembers.role })
      .from(spaceMembers)
      .where(and(
        eq(spaceMembers.spaceId, space.id),
        eq(spaceMembers.userId, userId),
      ))
      .limit(1);

    if (!membership || membership.role !== 'owner') {
      throw new ForbiddenException('Only space owner can delete the space');
    }

    await this.db.transaction(async (tx) => {
      await tx
        .update(spaces)
        .set({
          isDeleted: true,
          deletedAt: new Date(),
          coverMediaId: null,
        })
        .where(eq(spaces.id, space.id));

      if (space.coverMediaId) {
        await this.mediaService.markOrphanedIfUnreferenced(space.coverMediaId, tx);
      }
    });

    return { success: true };
  }

  // ── Membership ──

  async join(slug: string, userId: string, nickname?: string) {
    const [space] = await this.db
      .select()
      .from(spaces)
      .where(and(eq(spaces.slug, slug), eq(spaces.isDeleted, false)))
      .limit(1);

    if (!space) {
      throw new NotFoundException('Space not found');
    }

    const [existing] = await this.db
      .select({ id: spaceMembers.id })
      .from(spaceMembers)
      .where(and(
        eq(spaceMembers.spaceId, space.id),
        eq(spaceMembers.userId, userId),
      ))
      .limit(1);

    if (existing) {
      throw new ConflictException('You are already a member of this space');
    }

    if (nickname) {
      const [duplicate] = await this.db
        .select({ id: spaceMembers.id })
        .from(spaceMembers)
        .where(and(
          eq(spaceMembers.spaceId, space.id),
          eq(spaceMembers.spaceNickname, nickname),
        ))
        .limit(1);

      if (duplicate) {
        throw new ConflictException('This nickname is already taken in this space');
      }
    }

    await this.db.transaction(async (tx) => {
      await tx.insert(spaceMembers).values({
        spaceId: space.id,
        userId,
        role: 'member',
        spaceNickname: nickname ?? null,
      });

      await tx
        .update(spaces)
        .set({ memberCount: sql`${spaces.memberCount} + 1` })
        .where(eq(spaces.id, space.id));
    });

    const [user] = await this.db
      .select({
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: mediaAssets.publicUrl,
      })
      .from(users)
      .leftJoin(mediaAssets, eq(users.avatarMediaId, mediaAssets.id))
      .where(eq(users.id, userId))
      .limit(1);

    const [member] = await this.db
      .select()
      .from(spaceMembers)
      .where(and(
        eq(spaceMembers.spaceId, space.id),
        eq(spaceMembers.userId, userId),
      ))
      .limit(1);

    return {
      id: member.id,
      user,
      role: member.role,
      spaceNickname: member.spaceNickname,
      joinedAt: member.joinedAt.toISOString(),
    };
  }

  async leave(slug: string, userId: string) {
    const [space] = await this.db
      .select()
      .from(spaces)
      .where(and(eq(spaces.slug, slug), eq(spaces.isDeleted, false)))
      .limit(1);

    if (!space) {
      throw new NotFoundException('Space not found');
    }

    const [membership] = await this.db
      .select({ id: spaceMembers.id, role: spaceMembers.role })
      .from(spaceMembers)
      .where(and(
        eq(spaceMembers.spaceId, space.id),
        eq(spaceMembers.userId, userId),
      ))
      .limit(1);

    if (!membership) {
      throw new BadRequestException('You are not a member of this space');
    }

    if (membership.role === 'owner') {
      throw new ForbiddenException('Space owner cannot leave. Transfer ownership or delete the space instead.');
    }

    await this.db.transaction(async (tx) => {
      await tx
        .delete(spaceMembers)
        .where(eq(spaceMembers.id, membership.id));

      await tx
        .update(spaces)
        .set({ memberCount: sql`${spaces.memberCount} - 1` })
        .where(eq(spaces.id, space.id));
    });

    return { success: true };
  }

  async updateNickname(slug: string, userId: string, nickname: string | null | undefined) {
    const [space] = await this.db
      .select()
      .from(spaces)
      .where(and(eq(spaces.slug, slug), eq(spaces.isDeleted, false)))
      .limit(1);

    if (!space) {
      throw new NotFoundException('Space not found');
    }

    const [membership] = await this.db
      .select({ id: spaceMembers.id })
      .from(spaceMembers)
      .where(and(
        eq(spaceMembers.spaceId, space.id),
        eq(spaceMembers.userId, userId),
      ))
      .limit(1);

    if (!membership) {
      throw new ForbiddenException('You are not a member of this space');
    }

    if (nickname) {
      const [duplicate] = await this.db
        .select({ id: spaceMembers.id })
        .from(spaceMembers)
        .where(and(
          eq(spaceMembers.spaceId, space.id),
          eq(spaceMembers.spaceNickname, nickname),
          sql`${spaceMembers.id} != ${membership.id}`,
        ))
        .limit(1);

      if (duplicate) {
        throw new ConflictException('This nickname is already taken in this space');
      }
    }

    await this.db
      .update(spaceMembers)
      .set({ spaceNickname: nickname ?? null })
      .where(eq(spaceMembers.id, membership.id));

    const [user] = await this.db
      .select({
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: mediaAssets.publicUrl,
      })
      .from(users)
      .leftJoin(mediaAssets, eq(users.avatarMediaId, mediaAssets.id))
      .where(eq(users.id, userId))
      .limit(1);

    const [updatedMember] = await this.db
      .select()
      .from(spaceMembers)
      .where(eq(spaceMembers.id, membership.id))
      .limit(1);

    return {
      id: updatedMember.id,
      user,
      role: updatedMember.role,
      spaceNickname: updatedMember.spaceNickname,
      joinedAt: updatedMember.joinedAt.toISOString(),
    };
  }

  async getMembers(slug: string, cursor?: string, limit = 20) {
    const safeLimit = Math.min(limit, 50);

    const [space] = await this.db
      .select({ id: spaces.id })
      .from(spaces)
      .where(and(eq(spaces.slug, slug), eq(spaces.isDeleted, false)))
      .limit(1);

    if (!space) {
      throw new NotFoundException('Space not found');
    }

    const conditions = [eq(spaceMembers.spaceId, space.id)];
    if (cursor) {
      conditions.push(lt(spaceMembers.joinedAt, new Date(cursor)));
    }

    const rows = await this.db
      .select({
        id: spaceMembers.id,
        role: spaceMembers.role,
        spaceNickname: spaceMembers.spaceNickname,
        joinedAt: spaceMembers.joinedAt,
        user: {
          id: users.id,
          username: users.username,
          displayName: users.displayName,
          avatarUrl: mediaAssets.publicUrl,
        },
      })
      .from(spaceMembers)
      .innerJoin(users, eq(spaceMembers.userId, users.id))
      .leftJoin(mediaAssets, eq(users.avatarMediaId, mediaAssets.id))
      .where(and(...conditions))
      .orderBy(desc(spaceMembers.joinedAt))
      .limit(safeLimit + 1);

    const hasMore = rows.length > safeLimit;
    const resultRows = hasMore ? rows.slice(0, safeLimit) : rows;

    const data = resultRows.map((r) => ({
      id: r.id,
      user: r.user,
      role: r.role,
      spaceNickname: r.spaceNickname,
      joinedAt: r.joinedAt.toISOString(),
    }));

    const last = resultRows[resultRows.length - 1];
    return {
      data,
      meta: {
        hasMore,
        nextCursor: hasMore && last ? last.joinedAt.toISOString() : null,
      },
    };
  }

  /** Check membership — used internally by other modules */
  async checkMembership(spaceId: string, userId: string) {
    const [membership] = await this.db
      .select()
      .from(spaceMembers)
      .where(and(
        eq(spaceMembers.spaceId, spaceId),
        eq(spaceMembers.userId, userId),
      ))
      .limit(1);

    return membership ?? null;
  }

  /** Resolve space by slug — used internally */
  async resolveBySlug(slug: string) {
    const [space] = await this.db
      .select()
      .from(spaces)
      .where(and(eq(spaces.slug, slug), eq(spaces.isDeleted, false)))
      .limit(1);

    return space ?? null;
  }

  private async resolveCoverUrl(coverMediaId: string | null) {
    if (!coverMediaId) return null;

    const [asset] = await this.db
      .select({ publicUrl: mediaAssets.publicUrl })
      .from(mediaAssets)
      .where(eq(mediaAssets.id, coverMediaId))
      .limit(1);

    return asset?.publicUrl ?? null;
  }

  private async buildCoverUrlMap(coverMediaIds: Array<string | null>) {
    const ids = [...new Set(coverMediaIds.filter(Boolean))] as string[];
    const map = new Map<string, string>();
    if (ids.length === 0) return map;

    const assets = await this.db
      .select({ id: mediaAssets.id, publicUrl: mediaAssets.publicUrl })
      .from(mediaAssets)
      .where(inArray(mediaAssets.id, ids));

    for (const asset of assets) {
      map.set(asset.id, asset.publicUrl);
    }

    return map;
  }
}
