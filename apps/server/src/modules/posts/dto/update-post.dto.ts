import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

class UpdatePostAudioDto {
  @IsUUID('4')
  mediaId!: string;

  @IsArray()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(100, { each: true })
  waveform!: number[];
}

export class UpdatePostDto {
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  content?: string | null;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  mediaIds?: string[];

  @IsOptional()
  @ValidateNested()
  @Type(() => UpdatePostAudioDto)
  audio?: UpdatePostAudioDto | null;
}
