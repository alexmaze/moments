import { Module, forwardRef } from '@nestjs/common';
import { PostsService } from './posts.service';
import { PostsController } from './posts.controller';
import { MentionsModule } from '../mentions/mentions.module';
import { MediaModule } from '../media/media.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [MentionsModule, MediaModule, forwardRef(() => UsersModule)],
  controllers: [PostsController],
  providers: [PostsService],
  exports: [PostsService],
})
export class PostsModule {}
