/** Human-friendly comma-separated input is persisted as localized string arrays. */
export const MAX_ALBUM_TAGS = 16;
export const MAX_ALBUM_TAG_LENGTH = 40;

export function parseAlbumTags(value: string): string[] | null {
  const tags: string[] = [];
  const seen = new Set<string>();
  for (const candidate of value.split(',')) {
    const tag = candidate.trim();
    if (!tag) continue;
    if (tag.length > MAX_ALBUM_TAG_LENGTH || /[\r\n]/.test(tag)) return null;
    const key = tag.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    tags.push(tag);
    if (tags.length > MAX_ALBUM_TAGS) return null;
  }
  return tags;
}

export function formatAlbumTags(tags: readonly string[]): string {
  return tags.join(', ');
}
