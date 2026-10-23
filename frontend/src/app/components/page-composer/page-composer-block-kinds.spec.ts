import { pageComposerBlockKinds } from './page-composer-block-kinds';

describe('Page composer block palette', () => {
  const albumBlocks = ['albumDetails', 'albumTracks', 'albumCredits'];

  it('keeps album-specific elements out of normal pages', () => {
    const kinds = pageComposerBlockKinds('standard', false);
    expect(kinds).toEqual(['text', 'image', 'gallery', 'slider', 'cardCarousel', 'spacer', 'button', 'accordion', 'icon']);
    for (const kind of albumBlocks) expect(kinds).not.toContain(kind);
  });

  it('offers album details, tracks and credits with the album profile', () => {
    const kinds = pageComposerBlockKinds('album', false);
    for (const kind of albumBlocks) expect(kinds).toContain(kind);
  });

  it('recognizes an album from its context even with the default profile', () => {
    const kinds = pageComposerBlockKinds('standard', true);
    for (const kind of albumBlocks) expect(kinds).toContain(kind);
  });
});
