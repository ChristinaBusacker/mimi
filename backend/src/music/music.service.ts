import type {
  MusicAlbum,
  MusicAlbumReference,
  MusicAlbumSummary,
  MusicTrack,
  MusicTrackSummary,
} from '@shared/music/music';

import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { MusicAlbumTranslationEntry } from './entities/music-album-translation.entry';
import { MusicAlbumEntry } from './entities/music-album.entry';
import { MusicTrackTranslationEntry } from './entities/music-track-translation.entry';
import { MusicTrackEntry } from './entities/music-track.entry';
import {
  DEFAULT_MUSIC_LOCALE,
  type MusicLocale,
} from './music-locale';

@Injectable()
export class MusicService {
  constructor(
    @InjectRepository(MusicAlbumEntry)
    private readonly albumRepository: Repository<MusicAlbumEntry>,
    @InjectRepository(MusicAlbumTranslationEntry)
    private readonly albumTranslationRepository: Repository<MusicAlbumTranslationEntry>,
    @InjectRepository(MusicTrackEntry)
    private readonly trackRepository: Repository<MusicTrackEntry>,
    @InjectRepository(MusicTrackTranslationEntry)
    private readonly trackTranslationRepository: Repository<MusicTrackTranslationEntry>,
  ) {}

  async getAlbums(locale: MusicLocale): Promise<MusicAlbumSummary[]> {
    const albums = await this.albumRepository.find({
      where: {
        status: 'published',
      },
      order: {
        releasedAt: 'DESC',
        createdAt: 'DESC',
      },
    });

    if (albums.length === 0) {
      return [];
    }

    const translations = await this.albumTranslationRepository.find({
      where: {
        albumUuid: In(albums.map((album) => album.uuid)),
        locale: In(this.getLocalesWithFallback(locale)),
      },
    });

    return albums
      .map((album) => {
        const translation = this.pickTranslation(
          translations.filter(
            (candidate) => candidate.albumUuid === album.uuid,
          ),
          locale,
        );

        if (!translation) {
          return null;
        }

        return this.mapAlbumSummary(album, translation);
      })
      .filter((album): album is MusicAlbumSummary => album !== null);
  }

  async getAlbumBySlug(
    slug: string,
    locale: MusicLocale,
  ): Promise<MusicAlbum> {
    const album = await this.albumRepository.findOneBy({
      slug,
      status: 'published',
    });

    if (!album) {
      throw new NotFoundException(`Music album "${slug}" not found.`);
    }

    const translation = await this.getAlbumTranslation(
      album.uuid,
      locale,
    );

    if (!translation) {
      throw new NotFoundException(`Music album "${slug}" not found.`);
    }

    const tracks = await this.getPublishedTracksForAlbum(album.uuid);
    const trackTranslations = await this.getTrackTranslations(
      tracks.map((track) => track.uuid),
      locale,
    );

    return {
      ...this.mapAlbumSummary(album, translation),
      contentMarkdown: translation.contentMarkdown,
      tracks: tracks
        .map((track) => {
          const trackTranslation = this.pickTranslation(
            trackTranslations.filter(
              (candidate) => candidate.trackUuid === track.uuid,
            ),
            locale,
          );

          return trackTranslation
            ? this.mapTrackSummary(track, trackTranslation)
            : null;
        })
        .filter((track): track is MusicTrackSummary => track !== null),
    };
  }

  async getTrackBySlug(
    slug: string,
    locale: MusicLocale,
  ): Promise<MusicTrack> {
    const track = await this.trackRepository.findOneBy({
      slug,
      status: 'published',
    });

    if (!track) {
      throw new NotFoundException(`Music track "${slug}" not found.`);
    }

    const translation = await this.getTrackTranslation(
      track.uuid,
      locale,
    );

    if (!translation) {
      throw new NotFoundException(`Music track "${slug}" not found.`);
    }

    return {
      ...this.mapTrackSummary(track, translation),
      album: await this.getAlbumReference(track.albumUuid, locale),
      contentMarkdown: translation.contentMarkdown,
    };
  }

  private async getPublishedTracksForAlbum(
    albumUuid: string,
  ): Promise<MusicTrackEntry[]> {
    return this.trackRepository
      .createQueryBuilder('track')
      .where('track.albumUuid = :albumUuid', {
        albumUuid,
      })
      .andWhere('track.status = :status', {
        status: 'published',
      })
      .orderBy('track.trackNumber', 'ASC', 'NULLS LAST')
      .addOrderBy('track.createdAt', 'ASC')
      .getMany();
  }

  private async getAlbumTranslation(
    albumUuid: string,
    locale: MusicLocale,
  ): Promise<MusicAlbumTranslationEntry | null> {
    const translations = await this.albumTranslationRepository.find({
      where: {
        albumUuid,
        locale: In(this.getLocalesWithFallback(locale)),
      },
    });

    return this.pickTranslation(translations, locale);
  }

  private async getTrackTranslation(
    trackUuid: string,
    locale: MusicLocale,
  ): Promise<MusicTrackTranslationEntry | null> {
    const translations = await this.trackTranslationRepository.find({
      where: {
        trackUuid,
        locale: In(this.getLocalesWithFallback(locale)),
      },
    });

    return this.pickTranslation(translations, locale);
  }

  private async getTrackTranslations(
    trackUuids: string[],
    locale: MusicLocale,
  ): Promise<MusicTrackTranslationEntry[]> {
    if (trackUuids.length === 0) {
      return [];
    }

    return this.trackTranslationRepository.find({
      where: {
        trackUuid: In(trackUuids),
        locale: In(this.getLocalesWithFallback(locale)),
      },
    });
  }

  private async getAlbumReference(
    albumUuid: string | null,
    locale: MusicLocale,
  ): Promise<MusicAlbumReference | null> {
    if (!albumUuid) {
      return null;
    }

    const album = await this.albumRepository.findOneBy({
      uuid: albumUuid,
      status: 'published',
    });

    if (!album) {
      return null;
    }

    const translation = await this.getAlbumTranslation(
      album.uuid,
      locale,
    );

    if (!translation) {
      return null;
    }

    return {
      id: album.uuid,
      slug: album.slug,
      title: translation.title,
      coverAssetId: album.coverAssetId,
    };
  }

  private mapAlbumSummary(
    album: MusicAlbumEntry,
    translation: MusicAlbumTranslationEntry,
  ): MusicAlbumSummary {
    return {
      id: album.uuid,
      slug: album.slug,
      title: translation.title,
      coverAssetId: album.coverAssetId,
      releasedAt: album.releasedAt,
    };
  }

  private mapTrackSummary(
    track: MusicTrackEntry,
    translation: MusicTrackTranslationEntry,
  ): MusicTrackSummary {
    return {
      id: track.uuid,
      slug: track.slug,
      title: translation.title,
      trackNumber: track.trackNumber,
      durationSeconds: track.durationSeconds,
      previewDurationSeconds: track.previewDurationSeconds,
      previewAssetId: track.previewAssetId,
      coverAssetId: track.coverAssetId,
      spotifyUrl: track.spotifyUrl,
      deezerUrl: track.deezerUrl,
      supportUrl: track.supportUrl,
    };
  }

  private getLocalesWithFallback(
    locale: MusicLocale,
  ): MusicLocale[] {
    return locale === DEFAULT_MUSIC_LOCALE
      ? [locale]
      : [locale, DEFAULT_MUSIC_LOCALE];
  }

  private pickTranslation<
    TTranslation extends {
      locale: MusicLocale;
    },
  >(
    translations: TTranslation[],
    locale: MusicLocale,
  ): TTranslation | null {
    return (
      translations.find(
        (translation) => translation.locale === locale,
      ) ??
      translations.find(
        (translation) =>
          translation.locale === DEFAULT_MUSIC_LOCALE,
      ) ??
      null
    );
  }
}
