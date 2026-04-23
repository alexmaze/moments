import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminGuard } from './admin.guard';
import { AuthModule } from '../auth/auth.module';
import { MediaModule } from '../media/media.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [AuthModule, MediaModule, UsersModule],
  controllers: [AdminController],
  providers: [AdminService, AdminGuard],
  exports: [AdminService, AdminGuard],
})
export class AdminModule {}
