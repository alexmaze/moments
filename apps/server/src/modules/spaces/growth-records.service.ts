import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { eq, and, asc } from 'drizzle-orm';
import { DRIZZLE } from '../../database/database.module';
import {
  type DrizzleClient,
  growthRecords,
  users,
} from '@moments/db';
import { SpacesService } from './spaces.service';
import { CreateGrowthRecordDto } from './dto';

@Injectable()
export class GrowthRecordsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleClient,
    private readonly spacesService: SpacesService,
  ) {}

  async create(slug: string, userId: string, dto: CreateGrowthRecordDto) {
    // Validate at least one measurement
    if (
      dto.heightCm === undefined &&
      dto.weightKg === undefined &&
      dto.headCircumferenceCm === undefined
    ) {
      throw new BadRequestException('At least one measurement is required');
    }

    const space = await this.spacesService.resolveBySlug(slug);
    if (!space) {
      throw new NotFoundException('Space not found');
    }

    if (space.type !== 'baby') {
      throw new BadRequestException('Growth records are only available in baby spaces');
    }

    // Verify membership
    const membership = await this.spacesService.checkMembership(space.id, userId);
    if (!membership) {
      throw new ForbiddenException('You must be a member of this space');
    }

    const [record] = await this.db
      .insert(growthRecords)
      .values({
        spaceId: space.id,
        recordedBy: userId,
        date: new Date(dto.date),
        heightCm: dto.heightCm ?? null,
        weightKg: dto.weightKg ?? null,
        headCircumferenceCm: dto.headCircumferenceCm ?? null,
      })
      .returning();

    // Load recorder info
    const [recorder] = await this.db
      .select({
        id: users.id,
        displayName: users.displayName,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    return {
      id: record.id,
      date: record.date.toISOString(),
      heightCm: record.heightCm,
      weightKg: record.weightKg,
      headCircumferenceCm: record.headCircumferenceCm,
      recordedBy: recorder,
      createdAt: record.createdAt.toISOString(),
    };
  }

  async listBySpace(slug: string, userId: string) {
    const space = await this.spacesService.resolveBySlug(slug);
    if (!space) {
      throw new NotFoundException('Space not found');
    }

    if (space.type !== 'baby') {
      throw new BadRequestException('Growth records are only available in baby spaces');
    }

    // Verify membership
    const membership = await this.spacesService.checkMembership(space.id, userId);
    if (!membership) {
      throw new ForbiddenException('You must be a member of this space to view growth records');
    }

    const rows = await this.db
      .select({
        id: growthRecords.id,
        date: growthRecords.date,
        heightCm: growthRecords.heightCm,
        weightKg: growthRecords.weightKg,
        headCircumferenceCm: growthRecords.headCircumferenceCm,
        createdAt: growthRecords.createdAt,
        recorder: {
          id: users.id,
          displayName: users.displayName,
        },
      })
      .from(growthRecords)
      .innerJoin(users, eq(growthRecords.recordedBy, users.id))
      .where(eq(growthRecords.spaceId, space.id))
      .orderBy(asc(growthRecords.date));

    return rows.map((r) => ({
      id: r.id,
      date: r.date.toISOString(),
      heightCm: r.heightCm,
      weightKg: r.weightKg,
      headCircumferenceCm: r.headCircumferenceCm,
      recordedBy: r.recorder,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  async delete(slug: string, recordId: string, userId: string) {
    const space = await this.spacesService.resolveBySlug(slug);
    if (!space) {
      throw new NotFoundException('Space not found');
    }

    const [record] = await this.db
      .select()
      .from(growthRecords)
      .where(and(
        eq(growthRecords.id, recordId),
        eq(growthRecords.spaceId, space.id),
      ))
      .limit(1);

    if (!record) {
      throw new NotFoundException('Growth record not found');
    }

    // Only recorder, owner, or admin can delete
    if (record.recordedBy !== userId) {
      const membership = await this.spacesService.checkMembership(space.id, userId);
      if (!membership || membership.role === 'member') {
        throw new ForbiddenException('Only the recorder, space owner, or admin can delete this record');
      }
    }

    await this.db
      .delete(growthRecords)
      .where(eq(growthRecords.id, recordId));

    return { success: true };
  }
}
