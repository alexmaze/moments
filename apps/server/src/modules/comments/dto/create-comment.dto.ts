import { IsString, MinLength, MaxLength, IsOptional, IsUUID } from 'class-validator';

export class CreateCommentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  content!: string;

  @IsOptional()
  @IsUUID()
  replyToId?: string;
}
