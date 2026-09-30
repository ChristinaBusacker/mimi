import type {
  SaveSeoPageOverride,
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
  'about',
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
    format: 'uuid',
    nullable: true,
  })
  imageAssetId!: string | null;

  @ApiProperty({
    nullable: true,
  })
  imageDescription!: string | null;
}

export class SeoPageOverrideInputDto
  implements SaveSeoPageOverride
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
  @IsUUID()
  imageAssetId!: string | null;
}

export class SaveSeoPageOverridesDto
  implements SaveSeoPageOverrides
{
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SeoPageOverrideInputDto)
  pages!: SeoPageOverrideInputDto[];
}
