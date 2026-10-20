import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { MusicAlbumEditorialInputDto } from './save-music.dto';

const valid = () => ({
  genre: { de: 'Pop', en: 'Pop' },
  mood: { de: 'Verträumt', en: 'Dreamy' },
  credits: [{ name: 'Mimi', role: { de: 'Musik und Konzept', en: 'Music and concept' } }],
});

describe('Music album editorial metadata validation', () => {
  it('accepts localized genre, mood and contributor credits', () => {
    expect(validateSync(plainToInstance(MusicAlbumEditorialInputDto, valid()))).toHaveLength(0);
  });

  it('rejects invalid nested credits and overly long genre values', () => {
    const input = valid();
    input.genre.de = 'x'.repeat(101);
    input.credits[0].name = '   ';
    expect(validateSync(plainToInstance(MusicAlbumEditorialInputDto, input)).length).toBeGreaterThan(0);
  });

  it('rejects more than forty credits', () => {
    const input = valid();
    input.credits = Array.from({ length: 41 }, () => input.credits[0]);
    expect(validateSync(plainToInstance(MusicAlbumEditorialInputDto, input)).length).toBeGreaterThan(0);
  });

  it('requires both localized metadata objects and the credits collection', () => {
    const invalid = { mood: { de: '', en: '' } };
    expect(validateSync(plainToInstance(MusicAlbumEditorialInputDto, invalid)).length).toBeGreaterThan(0);
  });
});
