import { IsBoolean } from 'class-validator';

export class UpdateSecuritySettingsDto {
  @IsBoolean()
  registrationEnabled!: boolean;
}
