import { IsEmail, IsOptional, IsString, Length, MaxLength } from 'class-validator';

export class CreateSupportThreadDto {
  @IsEmail() @MaxLength(254) email!: string;
  @IsOptional() @IsString() @MaxLength(120) name?: string;
  @IsString() @Length(3, 160) subject!: string;
  @IsString() @Length(10, 5000) message!: string;
}

export class InboundSupportEmailDto {
  @IsEmail() @MaxLength(254) fromEmail!: string;
  @IsOptional() @IsString() @MaxLength(120) fromName?: string;
  @IsString() @Length(3, 160) subject!: string;
  @IsString() @Length(1, 10000) body!: string;
  @IsOptional() @IsString() @MaxLength(80) provider?: string;
  @IsOptional() @IsString() @MaxLength(300) providerMessageId?: string;
  @IsOptional() @IsString() @MaxLength(300) messageId?: string;
  @IsOptional() @IsString() @MaxLength(300) inReplyTo?: string;
  @IsOptional() @IsString() @MaxLength(2000) references?: string;
}

export class SupportReplyDto {
  @IsString() @Length(2, 5000) message!: string;
}
