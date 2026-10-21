import { BadRequestException } from '@nestjs/common';
import type { PageDocument } from '@shared/content/page-document';
import { describe, expect, it } from 'vitest';
import { validatePageDocument } from './page-document-validation';
import { validateAlbumBooklet } from '../music/album-booklet-validation';

const styles = { background: 'none' as const, gap: 16, padding: 0, radius: 0, align: 'left' as const };
function createDocument(): PageDocument {
  return {
    id: 'page', schemaVersion: 1, styles,
    sections: [{
      id: 'section', styles,
      rows: [{
        id: 'row', styles, layout: '1',
        columns: [{
          id: 'column', styles,
          blocks: [{ id: 'intro', type: 'text', styles, markdown: { de: 'Hallo', en: 'Hello' } }],
        }],
      }],
    }],
  };
}

describe('Generic page-document validation', () => {
  it('accepts a standard composer document without changing its structure', () => {
    const input = createDocument();
    expect(validatePageDocument(input)).toEqual(input);
    expect(validatePageDocument(input, 'standard')).toEqual(input);
  });

  it('does not allow album-only blocks in regular pages', () => {
    for (const block of [
      { id: 'details', type: 'albumDetails' as const, styles },
      { id: 'tracks', type: 'albumTracks' as const, styles },
      { id: 'credits', type: 'albumCredits' as const, styles, heading: { de: 'Credits', en: 'Credits' }, entries: [] },
    ]) {
      const input = createDocument();
      input.sections[0].rows[0].columns[0].blocks = [block];
      expect(() => validatePageDocument(input)).toThrow(BadRequestException);
      expect(() => validatePageDocument(input, 'standard')).toThrow(/album blocks/);
      expect(validatePageDocument(input, 'album').sections[0].rows[0].columns[0].blocks[0].type).toBe(block.type);
    }
  });

  it('preserves the current album-booklet validation entry point', () => {
    const input = createDocument();
    input.sections[0].rows[0].columns[0].blocks = [{ id: 'details', type: 'albumDetails', styles }];
    expect(validateAlbumBooklet(input)).toEqual(validatePageDocument(input, 'album'));
  });

  it('rejects duplicate node IDs and multiple album-track players', () => {
    const duplicate = createDocument();
    duplicate.sections[0].rows[0].columns[0].blocks[0].id = 'row';
    expect(() => validatePageDocument(duplicate)).toThrow(BadRequestException);

    const repeatedTracks = createDocument();
    repeatedTracks.sections[0].rows[0].columns[0].blocks = [
      { id: 'track-a', type: 'albumTracks', styles },
      { id: 'track-b', type: 'albumTracks', styles },
    ];
    expect(() => validatePageDocument(repeatedTracks, 'album')).toThrow(BadRequestException);
  });
});
