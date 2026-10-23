import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { MusicAlbumEditorialInputDto } from './save-music.dto';

const base = () => ({
  genre: { de: '', en: '' },
  mood: { de: '', en: '' },
  credits: [],
});

const errors = (editorial: object): number =>
  validateSync(plainToInstance(MusicAlbumEditorialInputDto, editorial)).length;

describe('Album links and localized tag validation', () => {
  it('accepts HTTPS album links, internal support destinations and localized tags', () => {
    expect(errors({ ...base(), spotifyUrl: 'https://open.spotify.com/album/123',
      deezerUrl: 'https://www.deezer.com/album/123', supportUrl: '/unterstuetzen',
      tags: { de: ['Indie', 'Verträumt'], en: ['Indie', 'Dreamy'] } })).toBe(0);
    expect(errors(base())).toBe(0); // historical albums with no new keys
    expect(errors({ ...base(), spotifyUrl: null, supportUrl: null })).toBe(0);
  });

  it('rejects insecure, script and protocol-relative destinations', () => {
    for (const value of ['http://example.com', 'javascript:alert(1)', '//evil.example']) {
      expect(errors({ ...base(), spotifyUrl: value })).toBeGreaterThan(0);
      expect(errors({ ...base(), supportUrl: value })).toBeGreaterThan(0);
    }
  });

  it('rejects oversized tags, too many tags and missing language arrays', () => {
    for (const tags of [
      { de: ['x'.repeat(41)], en: [] },
      { de: Array.from({ length: 17 }, (_, index) => `t${index}`), en: [] },
      { de: ['valid'], en: ['  '] },
      { de: ['repeat', 'repeat'], en: [] },
      { de: ['valid'] },
    ]) expect(errors({ ...base(), tags })).toBeGreaterThan(0);
  });
});
