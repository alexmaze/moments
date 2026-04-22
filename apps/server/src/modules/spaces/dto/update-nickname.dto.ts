import { IsOptional, IsString, MaxLength, Matches } from 'class-validator';

export class UpdateNicknameDto {
  @IsOptional()
  @IsString()
  @MaxLength(10)
  @Matches(/^\S+$/, { message: 'Nickname cannot contain spaces' })
  nickname?: string | null;
}

export class JoinSpaceDto {
  @IsOptional()
  @IsString()
  @MaxLength(10)
  @Matches(/^\S+$/, { message: 'Nickname cannot contain spaces' })
  nickname?: string;
}
