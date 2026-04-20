import { Controller, Get, Param, Query } from '@nestjs/common';
import { TagsService } from './tags.service';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('tags')
export class TagsController {
  constructor(private readonly tagsService: TagsService) {}

  @Get()
  @Public()
  async getTags(
    @Query('q') q?: string,
    @Query('limit') limit?: string,
  ) {
    return this.tagsService.getTags(q, limit ? parseInt(limit, 10) : 10);
  }

  @Get(':name/posts')
  @Public()
  async getTagPosts(
    @Param('name') name: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
    @Query('sort') sort?: string,
    @CurrentUser() currentUser?: { id: string },
  ) {
    return this.tagsService.getTagPosts(
      decodeURIComponent(name),
      cursor,
      limit ? parseInt(limit, 10) : 20,
      (sort as 'latest' | 'hot') || 'latest',
      currentUser?.id,
    );
  }
}