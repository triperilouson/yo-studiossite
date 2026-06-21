import { IsString, Length, Matches } from 'class-validator';

export class CompleteAdminMfaDto {
  @IsString() @Length(40, 200) challengeToken!: string;
  @IsString() @Matches(/^\d{6}$/) code!: string;
}

export class AdminMfaPasswordDto {
  @IsString() @Length(12, 200) currentPassword!: string;
}

export class ConfirmAdminMfaDto extends AdminMfaPasswordDto {
  @IsString() @Matches(/^\d{6}$/) code!: string;
}
