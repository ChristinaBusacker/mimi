import type {
  ContactLanguage,
  ContactMessageRequest,
} from '@shared/contact/contact-message';

import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';

export class ContactMessageDto
  implements ContactMessageRequest
{
  @IsString()
  @Length(2, 100)
  @Matches(/^[^\r\n]*\S[^\r\n]*$/u)
  name!: string;

  @IsEmail()
  @MaxLength(320)
  email!: string;

  @IsString()
  @Length(3, 160)
  @Matches(/^[^\r\n]*\S[^\r\n]*$/u)
  subject!: string;

  @IsString()
  @Length(10, 5000)
  @Matches(/\S/u)
  message!: string;

  @IsIn(['de', 'en'])
  language!: ContactLanguage;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  website?: string;
}
