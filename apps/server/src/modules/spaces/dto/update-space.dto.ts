import { IsString, IsOptional, MaxLength, MinLength, IsNumber, Min, Max, IsDateString } from 'class-validator';

export class UpdateSpaceDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  coverMediaId?: string | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  coverPositionY?: number;

  @IsOptional()
  @IsDateString()
  babyBirthday?: string | null;
}
