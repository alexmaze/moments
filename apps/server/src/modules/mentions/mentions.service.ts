import { Injectable, Inject } from '@nestjs/common';
import { DRIZZLE } from '../../database/database.module';
import { type DrizzleClient, mentions } from '@moments/db';
import { and, eq } from 'drizzle-orm';

@Injectable()
export class MentionsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleClient,
  ) {}

  async createMentions(
    entityType: 'post' | 'comment',
    entityId: string,
    mentionerId: string,
    mentionedUserIds: string[],
  ): Promise<void> {
    const filteredIds = mentionedUserIds.filter(id => id !== mentionerId);
    if (filteredIds.length === 0) return;

    const records = filteredIds.map(userId => ({
      entityType,
      entityId,
      mentionerId,
      mentionedUserId: userId,
    }));

    await this.db.insert(mentions).values(records);
  }

  async getMentionsForEntity(
    entityType: 'post' | 'comment',
    entityId: string,
  ) {
    const rows = await this.db
      .select()
      .from(mentions)
      .where(and(
        eq(mentions.entityType, entityType),
        eq(mentions.entityId, entityId),
      ));

    return rows;
  }

  async deleteMentionsForEntity(
    entityType: 'post' | 'comment',
    entityId: string,
  ): Promise<void> {
    await this.db
      .delete(mentions)
      .where(and(
        eq(mentions.entityType, entityType),
        eq(mentions.entityId, entityId),
      ));
  }
}
