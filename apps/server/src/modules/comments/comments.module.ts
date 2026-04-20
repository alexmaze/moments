import { Module, forwardRef } from '@nestjs/common';
import { CommentsService } from './comments.service';
import { CommentsController } from './comments.controller';
import { MentionsModule } from '../mentions/mentions.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [MentionsModule, forwardRef(() => UsersModule)],
  controllers: [CommentsController],
  providers: [CommentsService],
  exports: [CommentsService],
})
export class CommentsModule {}
