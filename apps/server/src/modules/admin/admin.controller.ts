import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Query,
  Param,
  UseGuards,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminGuard, AdminOnly } from './admin.guard';
import {
  ListUsersQueryDto,
  ListPostsQueryDto,
  UpdateSettingDto,
  UserIdParamDto,
  PostIdParamDto,
} from './dto';

@Controller('admin')
@UseGuards(AdminGuard)
@AdminOnly()
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // --- System Settings ---

  @Get('settings')
  async getSettings() {
    return this.adminService.getAllSettings();
  }

  @Post('settings/registration')
  async setRegistrationOpen(@Body() dto: UpdateSettingDto) {
    await this.adminService.setSetting('registration_open', dto.value);
    return { success: true };
  }

  // --- User Management ---

  @Get('users')
  async listUsers(@Query() query: ListUsersQueryDto) {
    return this.adminService.listUsers({
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 20,
      search: query.search,
      isActive: query.isActive,
    });
  }

  @Post('users/:userId/ban')
  async banUser(@Param() params: UserIdParamDto) {
    await this.adminService.banUser(params.userId);
    return { success: true };
  }

  @Post('users/:userId/unban')
  async unbanUser(@Param() params: UserIdParamDto) {
    await this.adminService.unbanUser(params.userId);
    return { success: true };
  }

  // --- Post Management ---

  @Get('posts')
  async listPosts(@Query() query: ListPostsQueryDto) {
    return this.adminService.listPosts({
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 20,
      authorId: query.authorId,
      search: query.search,
    });
  }

  @Delete('posts/:postId')
  async deletePost(@Param() params: PostIdParamDto) {
    await this.adminService.forceDeletePost(params.postId);
    return { success: true };
  }

  // --- Statistics ---

  @Get('stats')
  async getStats() {
    return this.adminService.getStats();
  }
}
