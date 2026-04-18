import { IsDateString, IsOptional, IsNumber, Min, Max } from 'class-validator';

export class CreateGrowthRecordDto {
  @IsDateString()
  date!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(300)
  heightCm?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(200)
  weightKg?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  headCircumferenceCm?: number;
}
