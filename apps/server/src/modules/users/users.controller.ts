import {
  Controller,
  Get,
  Patch,
  Post,
  Param,
  Body,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { UsersService } from './users.service';
import { PostsService } from '../posts/posts.service';
import { MediaService } from '../media/media.service';
import { UpdateProfileDto } from './dto';
import { CurrentUser } from '../../common/decorators';

@Controller()
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly postsService: PostsService,
    private readonly mediaService: MediaService,
  ) {}

  @Get('users/search')
  async searchUsers(
    @Query('q') q: string,
    @Query('limit') limit?: string,
  ) {
    return this.usersService.search(q, limit ? parseInt(limit, 10) : 10);
  }

  @Get('users/:username')
  async getProfile(@Param('username') username: string) {
    return this.usersService.getProfile(username);
  }

  @Get('users/:username/posts')
  async getUserPosts(
    @Param('username') username: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
    @CurrentUser() user?: { id: string },
  ) {
    return this.postsService.getUserPosts(username, cursor, limit ? parseInt(limit, 10) : 20, user?.id);
  }

  @Patch('users/me')
  async updateMe(
    @Body() dto: UpdateProfileDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.usersService.updateMe(user.id, dto);
  }

  @Post('users/me/avatar')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  async uploadAvatar(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: { id: string },
  ) {
    const asset = await this.mediaService.uploadFile(file, user.id);
    return this.usersService.updateAvatar(user.id, asset.publicUrl);
  }
}
