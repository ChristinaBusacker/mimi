import { HttpErrorResponse } from '@angular/common/http';
import { composerArchiveErrorMessage } from './composer-archive-error';

describe('composerArchiveErrorMessage', () => {
  it('reads a NestJS JSON error even when Angular wraps it in a Blob', async () => {
    const error = new HttpErrorResponse({
      status: 404,
      error: new Blob([JSON.stringify({ statusCode: 404, message:
        'Original file is missing for asset aaaa (used by page /about).' })],
      { type: 'application/json' }),
    });
    await expect(composerArchiveErrorMessage(error)).resolves.toContain('page /about');
  });

  it('provides the HTTP status and a useful fallback if the body is unavailable', async () => {
    const error = new HttpErrorResponse({ status: 413, error: new Blob(['not JSON']) });
    const message = await composerArchiveErrorMessage(error);
    expect(message).toContain('HTTP 413');
    expect(message).toContain('Größen- oder Anzahl-Limit');
  });

  it('distinguishes unavailable backend from an export validation error', async () => {
    const error = new HttpErrorResponse({ status: 0 });
    await expect(composerArchiveErrorMessage(error)).resolves.toContain('nicht erreichbar');
  });
});
