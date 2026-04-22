import { Controller, Post, Get, Param, ParseUUIDPipe, Query, DefaultValuePipe, ParseIntPipe } from '@nestjs/common';
import { LikesService } from './likes.service';
import { CurrentUser } from '../../common/decorators';

@Controller('posts/:postId')
export class LikesController {
  constructor(private readonly likesService: LikesService) {}

  @Post('like')
  async toggle(
    @Param('postId', ParseUUIDPipe) postId: string,
    @CurrentUser() user: { id: string; username: string },
  ) {
    return this.likesService.toggle(postId, user.id);
  }

  @Get('likes')
  async getLikedUsers(
    @Param('postId', ParseUUIDPipe) postId: string,
    @Query('cursor') cursor?: string,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit?: number,
    @CurrentUser() user?: { id: string; username: string },
  ) {
    const safeLimit = Math.min(limit ?? 20, 50);
    return this.likesService.getLikedUsers(postId, cursor, safeLimit, user?.id);
  }
}
