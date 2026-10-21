import type { PageDocument } from '@shared/content/page-document';
import { validatePageDocument } from '../content/page-document-validation';

/** Backwards-compatible entry point for album-booklet routes and existing tests. */
export function validateAlbumBooklet(value: unknown): PageDocument {
  return validatePageDocument(value, 'album');
}
