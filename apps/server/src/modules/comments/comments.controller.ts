import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto';
import { CurrentUser } from '../../common/decorators';

@Controller()
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Get('posts/:postId/comments')
  async listByPost(
    @Param('postId', ParseUUIDPipe) postId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.commentsService.listByPost(
      postId,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @Post('posts/:postId/comments')
  async create(
    @Param('postId', ParseUUIDPipe) postId: string,
    @Body() dto: CreateCommentDto,
    @CurrentUser() user: { id: string; username: string },
  ) {
    return this.commentsService.create(postId, user.id, dto);
  }

  @Delete('comments/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteOwn(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: { id: string; username: string },
  ) {
    await this.commentsService.deleteOwn(id, user.id);
  }
}
