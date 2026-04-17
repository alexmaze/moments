import { IsString, IsOptional, MaxLength, IsIn, ValidateIf } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  displayName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  bio?: string;

  @IsOptional()
  @ValidateIf((_obj, value) => value !== null)
  @IsString()
  @IsIn(['en', 'zh-CN'])
  locale?: string | null;

  @IsOptional()
  @ValidateIf((_obj, value) => value !== null)
  @IsString()
  @IsIn(['light', 'dark'])
  theme?: string | null;
}
