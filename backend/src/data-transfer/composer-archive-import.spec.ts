import { describe, expect, it } from 'vitest';
import { remapComposerAssets } from './composer-archive-import.service';

const from = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const to = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

describe('Composer archive asset mapping', () => {
  it('maps image references and bilingual inline Markdown but preserves node identities', () => {
    const source = { id: from, image: { assetId: from }, markdown: { de: `![Alt](asset:${from})`, en: `asset:${from}` }, other: from };
    const mapped = remapComposerAssets(source, new Map([[from, to]]));
    expect(mapped.id).toBe(from);
    expect(mapped.image.assetId).toBe(to);
    expect(mapped.markdown.de).toBe(`![Alt](asset:${to})`);
    expect(mapped.markdown.en).toBe(`asset:${to}`);
    expect(mapped.other).toBe(from);
    expect(source.image.assetId).toBe(from);
  });
});
