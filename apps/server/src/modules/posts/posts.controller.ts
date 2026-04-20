import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { PostsService } from './posts.service';
import { CreatePostDto } from './dto';
import { CurrentUser } from '../../common/decorators';

@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Get()
  async getFeed(
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
    @Query('tag') tag?: string,
    @CurrentUser() user?: { id: string },
  ) {
    return this.postsService.getFeed(
      cursor,
      limit ? parseInt(limit, 10) : 20,
      user?.id,
      tag ? decodeURIComponent(tag) : undefined,
    );
  }

  @Post()
  async create(
    @Body() dto: CreatePostDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.postsService.create(dto, user.id);
  }

  @Get(':id')
  async getById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user?: { id: string },
  ) {
    return this.postsService.getById(id, user?.id);
  }

  @Delete(':id')
  async deleteOwn(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.postsService.deleteOwn(id, user.id);
  }
}
