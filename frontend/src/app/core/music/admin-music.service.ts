import type {
  MusicAdminAlbum,
  MusicAdminTrack,
  ReorderMusicAdminTracks,
  SaveMusicAdminAlbum,
  SaveMusicAdminTrack,
} from '@shared/music/music-admin';

import {
  Injectable,
  inject,
} from '@angular/core';
import { Observable } from 'rxjs';

import { RequestService } from '../http/request.service';

@Injectable({
  providedIn: 'root',
})
export class AdminMusicService {
  private readonly request = inject(RequestService);

  getAlbums(): Observable<MusicAdminAlbum[]> {
    return this.request.get<MusicAdminAlbum[]>(
      '/admin/music/albums',
      this.privateGetOptions(),
    );
  }

  getAlbum(id: string): Observable<MusicAdminAlbum> {
    return this.request.get<MusicAdminAlbum>(
      `/admin/music/albums/${id}`,
      this.privateGetOptions(),
    );
  }

  createAlbum(
    input: SaveMusicAdminAlbum,
  ): Observable<MusicAdminAlbum> {
    return this.request.post<
      MusicAdminAlbum,
      SaveMusicAdminAlbum
    >('/admin/music/albums', input);
  }

  updateAlbum(
    id: string,
    input: SaveMusicAdminAlbum,
  ): Observable<MusicAdminAlbum> {
    return this.request.patch<
      MusicAdminAlbum,
      SaveMusicAdminAlbum
    >(`/admin/music/albums/${id}`, input);
  }

  deleteAlbum(id: string): Observable<void> {
    return this.request.delete<void>(
      `/admin/music/albums/${id}`,
    );
  }

  reorderAlbumTracks(
    albumId: string,
    trackIds: string[],
  ): Observable<MusicAdminTrack[]> {
    return this.request.patch<
      MusicAdminTrack[],
      ReorderMusicAdminTracks
    >(
      `/admin/music/albums/${albumId}/tracks/order`,
      {
        trackIds,
      },
    );
  }

  getTracks(): Observable<MusicAdminTrack[]> {
    return this.request.get<MusicAdminTrack[]>(
      '/admin/music/tracks',
      this.privateGetOptions(),
    );
  }

  getTrack(id: string): Observable<MusicAdminTrack> {
    return this.request.get<MusicAdminTrack>(
      `/admin/music/tracks/${id}`,
      this.privateGetOptions(),
    );
  }

  createTrack(
    input: SaveMusicAdminTrack,
  ): Observable<MusicAdminTrack> {
    return this.request.post<
      MusicAdminTrack,
      SaveMusicAdminTrack
    >('/admin/music/tracks', input);
  }

  updateTrack(
    id: string,
    input: SaveMusicAdminTrack,
  ): Observable<MusicAdminTrack> {
    return this.request.patch<
      MusicAdminTrack,
      SaveMusicAdminTrack
    >(`/admin/music/tracks/${id}`, input);
  }

  deleteTrack(id: string): Observable<void> {
    return this.request.delete<void>(
      `/admin/music/tracks/${id}`,
    );
  }

  private privateGetOptions(): {
    deduplicateAcrossTabs: false;
    transferCache: false;
  } {
    return {
      deduplicateAcrossTabs: false,
      transferCache: false,
    };
  }
}
