import { Module } from '@nestjs/common';
import { PostsModule } from '../posts/posts.module';
import { SpacesService } from './spaces.service';
import { GrowthRecordsService } from './growth-records.service';
import { SpacesController } from './spaces.controller';

@Module({
  imports: [PostsModule],
  controllers: [SpacesController],
  providers: [SpacesService, GrowthRecordsService],
  exports: [SpacesService],
})
export class SpacesModule {}
