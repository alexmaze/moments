import { Module, forwardRef } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { PostsModule } from '../posts/posts.module';
import { MediaModule } from '../media/media.module';

@Module({
  imports: [forwardRef(() => PostsModule), MediaModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
