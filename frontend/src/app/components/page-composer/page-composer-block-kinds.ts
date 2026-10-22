import type { PageBlock, PageComposerProfile } from '@shared/content/page-document';

type BlockKind = PageBlock['type'];

const STANDARD_BLOCK_KINDS: readonly BlockKind[] = [
  'text', 'image', 'gallery', 'slider', 'cardCarousel', 'spacer',
];
const ALBUM_BLOCK_KINDS: readonly BlockKind[] = [
  ...STANDARD_BLOCK_KINDS, 'albumDetails', 'albumTracks', 'albumCredits',
];

/** Album context is sufficient even if a caller forgets the explicit profile binding. */
export function pageComposerBlockKinds(
  profile: PageComposerProfile,
  hasAlbumContext: boolean,
): readonly BlockKind[] {
  return profile === 'album' || hasAlbumContext ? ALBUM_BLOCK_KINDS : STANDARD_BLOCK_KINDS;
}
