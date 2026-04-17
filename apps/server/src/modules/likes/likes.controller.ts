import { Controller, Post, Param, ParseUUIDPipe } from '@nestjs/common';
import { LikesService } from './likes.service';
import { CurrentUser } from '../../common/decorators';

@Controller('posts/:postId/like')
export class LikesController {
  constructor(private readonly likesService: LikesService) {}

  @Post()
  async toggle(
    @Param('postId', ParseUUIDPipe) postId: string,
    @CurrentUser() user: { id: string; username: string },
  ) {
    return this.likesService.toggle(postId, user.id);
  }
}
