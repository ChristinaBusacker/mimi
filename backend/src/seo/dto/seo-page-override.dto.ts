import type {
  SaveSeoPageOverrides,
  SeoPageOverride,
  SeoLocale,
  SeoStaticPageKey,
} from '@shared/seo/seo';

import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

const SEO_PAGE_KEYS: readonly SeoStaticPageKey[] = [
  'home',
  'gaming',
  'music',
  'blog',
  'videos',
  'community',
  'contact',
  'support',
  'legalNotice',
  'privacy',
];

const SEO_LOCALES: readonly SeoLocale[] = [
  'de',
  'en',
];

export class SeoPageOverrideDto
  implements SeoPageOverride
{
  @ApiProperty({
    enum: SEO_PAGE_KEYS,
  })
  pageKey!: SeoStaticPageKey;

  @ApiProperty({
    enum: SEO_LOCALES,
  })
  locale!: SeoLocale;

  @ApiProperty({
    nullable: true,
  })
  title!: string | null;

  @ApiProperty({
    nullable: true,
  })
  description!: string | null;

  @ApiProperty({
    nullable: true,
  })
  socialTitle!: string | null;

  @ApiProperty({
    nullable: true,
  })
  socialDescription!: string | null;

  @ApiProperty({
    format: 'uuid',
    nullable: true,
  })
  socialImageAssetId!: string | null;

  @ApiProperty({
    nullable: true,
  })
  socialImageAlt!: string | null;
}

export class SeoPageOverrideInputDto
  implements SeoPageOverride
{
  @IsIn(SEO_PAGE_KEYS)
  pageKey!: SeoStaticPageKey;

  @IsIn(SEO_LOCALES)
  locale!: SeoLocale;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  title!: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description!: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  socialTitle!: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  socialDescription!: string | null;

  @IsOptional()
  @IsUUID()
  socialImageAssetId!: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  socialImageAlt!: string | null;
}

export class SaveSeoPageOverridesDto
  implements SaveSeoPageOverrides
{
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SeoPageOverrideInputDto)
  pages!: SeoPageOverrideInputDto[];
}
