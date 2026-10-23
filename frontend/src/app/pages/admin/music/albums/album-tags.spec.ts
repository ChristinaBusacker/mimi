import { formatAlbumTags, parseAlbumTags } from './album-tags';

describe('Localized album tags', () => {
  it('normalizes comma-separated tags, preserving the first spelling', () => {
    expect(parseAlbumTags(' Indie Pop, dreamy , indie pop, Synthwave, '))
      .toEqual(['Indie Pop', 'dreamy', 'Synthwave']);
  });

  it('accepts empty tag lists and round-trips localized arrays', () => {
    expect(parseAlbumTags('')).toEqual([]);
    expect(parseAlbumTags(formatAlbumTags(['Melancholie', 'Indie-Rock'])))
      .toEqual(['Melancholie', 'Indie-Rock']);
  });

  it('rejects too many tags and values longer than forty characters', () => {
    expect(parseAlbumTags(Array.from({ length: 17 }, (_, index) => `tag${index}`).join(','))).toBeNull();
    expect(parseAlbumTags('x'.repeat(41))).toBeNull();
    expect(parseAlbumTags('good, bad\nline')).toBeNull();
  });
});
