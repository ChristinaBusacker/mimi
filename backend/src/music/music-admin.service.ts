import type { AssetType } from '@shared/assets/asset';
import type {
  MusicAdminAlbum,
  MusicAdminTrack,
  MusicAdminTranslation,
  MusicAdminTranslations,
} from '@shared/music/music-admin';

import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Not, Repository } from 'typeorm';

import { AssetsService } from '../assets/assets.service';
import {
  MusicAdminTranslationInputDto,
  MusicAdminTranslationsInputDto,
  SaveMusicAdminAlbumDto,
  SaveMusicAdminTrackDto,
} from './dto/save-music.dto';
import { MusicAlbumTranslationEntry } from './entities/music-album-translation.entry';
import { MusicAlbumEntry } from './entities/music-album.entry';
import { MusicTrackTranslationEntry } from './entities/music-track-translation.entry';
import { MusicTrackEntry } from './entities/music-track.entry';

@Injectable()
export class MusicAdminService {
  constructor(
    private readonly assetsService: AssetsService,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @InjectRepository(MusicAlbumEntry)
    private readonly albumRepository: Repository<MusicAlbumEntry>,
    @InjectRepository(MusicAlbumTranslationEntry)
    private readonly albumTranslationRepository: Repository<MusicAlbumTranslationEntry>,
    @InjectRepository(MusicTrackEntry)
    private readonly trackRepository: Repository<MusicTrackEntry>,
    @InjectRepository(MusicTrackTranslationEntry)
    private readonly trackTranslationRepository: Repository<MusicTrackTranslationEntry>,
  ) {}

  async getAlbums(): Promise<MusicAdminAlbum[]> {
    const albums = await this.albumRepository.find({
      order: {
        createdAt: 'DESC',
      },
    });

    const translations = await this.getAlbumTranslations(albums.map((album) => album.uuid));

    return albums.map((album) =>
      this.mapAlbum(
        album,
        translations.filter((translation) => translation.albumUuid === album.uuid),
      ),
    );
  }

  async getAlbum(uuid: string): Promise<MusicAdminAlbum> {
    const album = await this.findAlbum(uuid);
    const translations = await this.albumTranslationRepository.findBy({
      albumUuid: uuid,
    });

    return this.mapAlbum(album, translations);
  }

  async createAlbum(dto: SaveMusicAdminAlbumDto): Promise<MusicAdminAlbum> {
    await this.assertAssetType(dto.coverAssetId, 'image');
    await this.assertAlbumSlugAvailable(dto.slug);

    const uuid = await this.dataSource.transaction(async (manager) => {
      const album = await manager.getRepository(MusicAlbumEntry).save(
        manager.getRepository(MusicAlbumEntry).create({
          slug: dto.slug,
          coverAssetId: dto.coverAssetId,
          releasedAt: dto.releasedAt,
          status: dto.status,
        }),
      );

      await this.replaceAlbumTranslations(manager, album.uuid, dto.translations);

      return album.uuid;
    });

    return this.getAlbum(uuid);
  }

  async updateAlbum(uuid: string, dto: SaveMusicAdminAlbumDto): Promise<MusicAdminAlbum> {
    const album = await this.findAlbum(uuid);

    await this.assertAssetType(dto.coverAssetId, 'image');
    await this.assertAlbumSlugAvailable(dto.slug, uuid);

    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(MusicAlbumEntry).save({
        ...album,
        slug: dto.slug,
        coverAssetId: dto.coverAssetId,
        releasedAt: dto.releasedAt,
        status: dto.status,
      });

      await this.replaceAlbumTranslations(manager, uuid, dto.translations);
    });

    return this.getAlbum(uuid);
  }

  async deleteAlbum(uuid: string): Promise<void> {
    const result = await this.albumRepository.delete({
      uuid,
    });

    if (result.affected === 0) {
      throw new NotFoundException(`Music album "${uuid}" not found.`);
    }
  }

  async reorderAlbumTracks(
    albumUuid: string,
    trackIds: string[],
  ): Promise<MusicAdminTrack[]> {
    await this.findAlbum(albumUuid);

    const tracks = await this.trackRepository.find({
      where: {
        albumUuid,
      },
    });

    const albumTrackIds = new Set(
      tracks.map((track) => track.uuid),
    );

    if (
      tracks.length !== trackIds.length ||
      trackIds.some(
        (trackId) => !albumTrackIds.has(trackId),
      )
    ) {
      throw new BadRequestException(
        'Track order must contain every track of the album exactly once.',
      );
    }

    await this.dataSource.transaction(
      async (manager) => {
        const repository =
          manager.getRepository(MusicTrackEntry);

        for (
          let index = 0;
          index < trackIds.length;
          index += 1
        ) {
          await repository.update(
            {
              uuid: trackIds[index],
              albumUuid,
            },
            {
              trackNumber: index + 1,
            },
          );
        }
      },
    );

    return this.getAlbumTracks(albumUuid);
  }

  async getTracks(): Promise<MusicAdminTrack[]> {
    const tracks = await this.trackRepository.find({
      order: {
        createdAt: 'DESC',
      },
    });

    const translations = await this.getTrackTranslations(tracks.map((track) => track.uuid));

    return tracks.map((track) =>
      this.mapTrack(
        track,
        translations.filter((translation) => translation.trackUuid === track.uuid),
      ),
    );
  }

  async getTrack(uuid: string): Promise<MusicAdminTrack> {
    const track = await this.findTrack(uuid);
    const translations = await this.trackTranslationRepository.findBy({
      trackUuid: uuid,
    });

    return this.mapTrack(track, translations);
  }

  async createTrack(dto: SaveMusicAdminTrackDto): Promise<MusicAdminTrack> {
    await this.validateTrackReferences(dto);
    await this.assertTrackSlugAvailable(dto.slug);
    this.validateDurations(dto);

    const uuid = await this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(MusicTrackEntry);

      const track = await repository.save(
        repository.create({
          slug: dto.slug,
          albumUuid: dto.albumId,
          trackNumber: dto.trackNumber,
          durationSeconds: dto.durationSeconds,
          previewDurationSeconds: dto.previewDurationSeconds,
          previewAssetId: dto.previewAssetId,
          coverAssetId: dto.coverAssetId,
          spotifyUrl: dto.spotifyUrl || null,
          deezerUrl: dto.deezerUrl || null,
          supportUrl: dto.supportUrl || null,
          status: dto.status,
        }),
      );

      await this.replaceTrackTranslations(manager, track.uuid, dto.translations);

      return track.uuid;
    });

    return this.getTrack(uuid);
  }

  async updateTrack(uuid: string, dto: SaveMusicAdminTrackDto): Promise<MusicAdminTrack> {
    const track = await this.findTrack(uuid);

    await this.validateTrackReferences(dto);
    await this.assertTrackSlugAvailable(dto.slug, uuid);
    this.validateDurations(dto);

    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(MusicTrackEntry).save({
        ...track,
        slug: dto.slug,
        albumUuid: dto.albumId,
        trackNumber: dto.trackNumber,
        durationSeconds: dto.durationSeconds,
        previewDurationSeconds: dto.previewDurationSeconds,
        previewAssetId: dto.previewAssetId,
        coverAssetId: dto.coverAssetId,
        spotifyUrl: dto.spotifyUrl || null,
        deezerUrl: dto.deezerUrl || null,
        supportUrl: dto.supportUrl || null,
        status: dto.status,
      });

      await this.replaceTrackTranslations(manager, uuid, dto.translations);
    });

    return this.getTrack(uuid);
  }

  async deleteTrack(uuid: string): Promise<void> {
    const result = await this.trackRepository.delete({
      uuid,
    });

    if (result.affected === 0) {
      throw new NotFoundException(`Music track "${uuid}" not found.`);
    }
  }

  private async getAlbumTracks(
    albumUuid: string,
  ): Promise<MusicAdminTrack[]> {
    const tracks = await this.trackRepository.find({
      where: {
        albumUuid,
      },
      order: {
        trackNumber: 'ASC',
        createdAt: 'ASC',
      },
    });

    const translations =
      await this.getTrackTranslations(
        tracks.map((track) => track.uuid),
      );

    return tracks.map((track) =>
      this.mapTrack(
        track,
        translations.filter(
          (translation) =>
            translation.trackUuid === track.uuid,
        ),
      ),
    );
  }

  private async findAlbum(uuid: string): Promise<MusicAlbumEntry> {
    const album = await this.albumRepository.findOneBy({
      uuid,
    });

    if (!album) {
      throw new NotFoundException(`Music album "${uuid}" not found.`);
    }

    return album;
  }

  private async findTrack(uuid: string): Promise<MusicTrackEntry> {
    const track = await this.trackRepository.findOneBy({
      uuid,
    });

    if (!track) {
      throw new NotFoundException(`Music track "${uuid}" not found.`);
    }

    return track;
  }

  private async assertAlbumSlugAvailable(slug: string, currentUuid?: string): Promise<void> {
    const existing = await this.albumRepository.findOne({
      where: {
        slug,
        ...(currentUuid
          ? {
              uuid: Not(currentUuid),
            }
          : {}),
      },
    });

    if (existing) {
      throw new ConflictException(`Music album slug "${slug}" already exists.`);
    }
  }

  private async assertTrackSlugAvailable(slug: string, currentUuid?: string): Promise<void> {
    const existing = await this.trackRepository.findOne({
      where: {
        slug,
        ...(currentUuid
          ? {
              uuid: Not(currentUuid),
            }
          : {}),
      },
    });

    if (existing) {
      throw new ConflictException(`Music track slug "${slug}" already exists.`);
    }
  }

  private async validateTrackReferences(dto: SaveMusicAdminTrackDto): Promise<void> {
    if (dto.albumId) {
      await this.findAlbum(dto.albumId);
    }

    await Promise.all([
      this.assertAssetType(dto.coverAssetId, 'image'),
      this.assertAssetType(dto.previewAssetId, 'audio'),
    ]);
  }

  private validateDurations(dto: SaveMusicAdminTrackDto): void {
    if (
      dto.previewAssetId &&
      dto.previewDurationSeconds < 1
    ) {
      throw new BadRequestException(
        'A preview asset requires a valid preview duration.',
      );
    }

    if (
      !dto.previewAssetId &&
      dto.previewDurationSeconds !== 0
    ) {
      throw new BadRequestException(
        'A preview duration requires a preview asset.',
      );
    }

    if (
      dto.previewDurationSeconds >
      dto.durationSeconds
    ) {
      throw new BadRequestException(
        'The preview duration cannot exceed the track duration.',
      );
    }
  }

  private async assertAssetType(uuid: string | null, expectedType: AssetType): Promise<void> {
    if (!uuid) {
      return;
    }

    const asset = await this.assetsService.getById(uuid);

    if (asset.type !== expectedType) {
      throw new BadRequestException(`Asset "${uuid}" must be of type "${expectedType}".`);
    }
  }

  private async replaceAlbumTranslations(
    manager: EntityManager,
    albumUuid: string,
    translations: MusicAdminTranslationsInputDto,
  ): Promise<void> {
    const repository = manager.getRepository(MusicAlbumTranslationEntry);

    await this.saveAlbumTranslation(repository, albumUuid, 'de', translations.de);

    if (translations.en) {
      await this.saveAlbumTranslation(repository, albumUuid, 'en', translations.en);
    } else {
      await repository.delete({
        albumUuid,
        locale: 'en',
      });
    }
  }

  private async saveAlbumTranslation(
    repository: Repository<MusicAlbumTranslationEntry>,
    albumUuid: string,
    locale: 'de' | 'en',
    translation: MusicAdminTranslationInputDto,
  ): Promise<void> {
    const existing = await repository.findOneBy({
      albumUuid,
      locale,
    });

    await repository.save(
      existing
        ? {
            ...existing,
            title: translation.title,
            contentMarkdown: translation.contentMarkdown,
          }
        : repository.create({
            albumUuid,
            locale,
            title: translation.title,
            contentMarkdown: translation.contentMarkdown,
          }),
    );
  }

  private async replaceTrackTranslations(
    manager: EntityManager,
    trackUuid: string,
    translations: MusicAdminTranslationsInputDto,
  ): Promise<void> {
    const repository = manager.getRepository(MusicTrackTranslationEntry);

    await this.saveTrackTranslation(repository, trackUuid, 'de', translations.de);

    if (translations.en) {
      await this.saveTrackTranslation(repository, trackUuid, 'en', translations.en);
    } else {
      await repository.delete({
        trackUuid,
        locale: 'en',
      });
    }
  }

  private async saveTrackTranslation(
    repository: Repository<MusicTrackTranslationEntry>,
    trackUuid: string,
    locale: 'de' | 'en',
    translation: MusicAdminTranslationInputDto,
  ): Promise<void> {
    const existing = await repository.findOneBy({
      trackUuid,
      locale,
    });

    await repository.save(
      existing
        ? {
            ...existing,
            title: translation.title,
            contentMarkdown: translation.contentMarkdown,
          }
        : repository.create({
            trackUuid,
            locale,
            title: translation.title,
            contentMarkdown: translation.contentMarkdown,
          }),
    );
  }

  private async getAlbumTranslations(albumUuids: string[]): Promise<MusicAlbumTranslationEntry[]> {
    if (albumUuids.length === 0) {
      return [];
    }

    return this.albumTranslationRepository.findBy({
      albumUuid: In(albumUuids),
    });
  }

  private async getTrackTranslations(trackUuids: string[]): Promise<MusicTrackTranslationEntry[]> {
    if (trackUuids.length === 0) {
      return [];
    }

    return this.trackTranslationRepository.findBy({
      trackUuid: In(trackUuids),
    });
  }

  private mapAlbum(
    album: MusicAlbumEntry,
    translations: MusicAlbumTranslationEntry[],
  ): MusicAdminAlbum {
    return {
      id: album.uuid,
      slug: album.slug,
      coverAssetId: album.coverAssetId,
      releasedAt: album.releasedAt,
      status: album.status,
      translations: this.mapTranslations(translations),
      createdAt: album.createdAt.toISOString(),
      updatedAt: album.updatedAt.toISOString(),
    };
  }

  private mapTrack(
    track: MusicTrackEntry,
    translations: MusicTrackTranslationEntry[],
  ): MusicAdminTrack {
    return {
      id: track.uuid,
      slug: track.slug,
      albumId: track.albumUuid,
      trackNumber: track.trackNumber,
      durationSeconds: track.durationSeconds,
      previewDurationSeconds: track.previewDurationSeconds,
      previewAssetId: track.previewAssetId,
      coverAssetId: track.coverAssetId,
      spotifyUrl: track.spotifyUrl,
      deezerUrl: track.deezerUrl,
      supportUrl: track.supportUrl,
      status: track.status,
      translations: this.mapTranslations(translations),
      createdAt: track.createdAt.toISOString(),
      updatedAt: track.updatedAt.toISOString(),
    };
  }

  private mapTranslations(
    translations: Array<{
      locale: 'de' | 'en';
      title: string;
      contentMarkdown: string;
    }>,
  ): MusicAdminTranslations {
    const german = translations.find((translation) => translation.locale === 'de');
    const english = translations.find((translation) => translation.locale === 'en');

    return {
      de: german
        ? this.mapTranslation(german)
        : {
            title: '',
            contentMarkdown: '',
          },
      en: english ? this.mapTranslation(english) : null,
    };
  }

  private mapTranslation(translation: {
    title: string;
    contentMarkdown: string;
  }): MusicAdminTranslation {
    return {
      title: translation.title,
      contentMarkdown: translation.contentMarkdown,
    };
  }
}
