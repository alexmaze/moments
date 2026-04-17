import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { Public } from '../../common/decorators';
import { CurrentUser } from '../../common/decorators';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @UseGuards(LocalAuthGuard)
  @Post('login')
  async login(@Request() req: { user: { id: string; username: string; displayName: string; avatarUrl: string | null; bio: string | null; passwordHash: string; isActive: boolean; createdAt: Date; updatedAt: Date } }) {
    return this.authService.login(req.user);
  }

  @Get('me')
  async getProfile(@CurrentUser() user: { id: string; username: string }) {
    return this.authService.getProfile(user.id);
  }
}
