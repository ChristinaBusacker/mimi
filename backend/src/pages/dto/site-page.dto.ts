import type { CreateSitePageInput, SitePageMetadata } from '@shared/content/site-page';
import { Type } from 'class-transformer';
import {
  IsBoolean, IsDefined, IsObject, IsOptional, IsString, IsUUID,
  Matches, MaxLength, ValidateNested,
} from 'class-validator';

export class SitePageLocalizedTitleDto {
  @IsString()
  @MaxLength(160)
  de!: string;

  @IsString()
  @MaxLength(160)
  en!: string;
}

export class SitePageLocalizedDescriptionDto {
  @IsString()
  @MaxLength(500)
  de!: string;

  @IsString()
  @MaxLength(500)
  en!: string;
}

export class SitePageMetadataDto implements SitePageMetadata {
  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => SitePageLocalizedTitleDto)
  title!: SitePageLocalizedTitleDto;

  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => SitePageLocalizedTitleDto)
  seoTitle!: SitePageLocalizedTitleDto;

  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => SitePageLocalizedDescriptionDto)
  seoDescription!: SitePageLocalizedDescriptionDto;

  @IsOptional()
  @IsUUID('4')
  seoImageAssetId!: string | null;

  @IsBoolean()
  indexable!: boolean;
}

export class CreateSitePageDto implements CreateSitePageInput {
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  @MaxLength(160)
  slug!: string;

  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => SitePageMetadataDto)
  metadata!: SitePageMetadataDto;
}

export class UpdateSitePageMetadataDto {
  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => SitePageMetadataDto)
  metadata!: SitePageMetadataDto;
}

export class SaveSitePageDraftDto {
  @IsDefined()
  @IsObject()
  document!: unknown;
}
