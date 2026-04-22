import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { SpacesService } from './spaces.service';
import { GrowthRecordsService } from './growth-records.service';
import { PostsService } from '../posts/posts.service';
import { CreateSpaceDto, UpdateSpaceDto, CreateGrowthRecordDto, UpdateNicknameDto, JoinSpaceDto } from './dto';
import { CurrentUser } from '../../common/decorators';

@Controller('spaces')
export class SpacesController {
  constructor(
    private readonly spacesService: SpacesService,
    private readonly growthRecordsService: GrowthRecordsService,
    private readonly postsService: PostsService,
  ) {}

  // ── Space CRUD ──

  @Get()
  async list(
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.spacesService.list(cursor, limit ? parseInt(limit, 10) : 20);
  }

  /** Must be before :slug to avoid "my" being treated as a slug */
  @Get('my')
  async listMySpaces(@CurrentUser() user: { id: string }) {
    return this.spacesService.listMySpaces(user.id);
  }

  @Post()
  async create(
    @Body() dto: CreateSpaceDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.spacesService.create(dto, user.id);
  }

  @Get(':slug')
  async getBySlug(
    @Param('slug') slug: string,
    @CurrentUser() user?: { id: string },
  ) {
    return this.spacesService.getBySlug(slug, user?.id);
  }

  @Patch(':slug')
  async update(
    @Param('slug') slug: string,
    @Body() dto: UpdateSpaceDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.spacesService.update(slug, dto, user.id);
  }

  @Delete(':slug')
  async delete(
    @Param('slug') slug: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.spacesService.delete(slug, user.id);
  }

  // ── Membership ──

  @Post(':slug/join')
  async join(
    @Param('slug') slug: string,
    @Body() dto: JoinSpaceDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.spacesService.join(slug, user.id, dto.nickname);
  }

  @Patch(':slug/members/me')
  async updateMyNickname(
    @Param('slug') slug: string,
    @Body() dto: UpdateNicknameDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.spacesService.updateNickname(slug, user.id, dto.nickname);
  }

  @Delete(':slug/leave')
  async leave(
    @Param('slug') slug: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.spacesService.leave(slug, user.id);
  }

  @Get(':slug/members')
  async getMembers(
    @Param('slug') slug: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.spacesService.getMembers(slug, cursor, limit ? parseInt(limit, 10) : 20);
  }

  // ── Space Posts ──

  @Get(':slug/posts')
  async getSpacePosts(
    @Param('slug') slug: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
    @CurrentUser() user?: { id: string },
  ) {
    const space = await this.spacesService.resolveBySlug(slug);
    if (!space) {
      throw new Error('Space not found');
    }
    return this.postsService.getSpacePosts(space.id, cursor, limit ? parseInt(limit, 10) : 20, user?.id);
  }

  // ── Growth Records ──

  @Post(':slug/growth-records')
  async createGrowthRecord(
    @Param('slug') slug: string,
    @Body() dto: CreateGrowthRecordDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.growthRecordsService.create(slug, user.id, dto);
  }

  @Get(':slug/growth-records')
  async getGrowthRecords(
    @Param('slug') slug: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.growthRecordsService.listBySpace(slug, user.id);
  }

  @Delete(':slug/growth-records/:id')
  async deleteGrowthRecord(
    @Param('slug') slug: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.growthRecordsService.delete(slug, id, user.id);
  }
}
