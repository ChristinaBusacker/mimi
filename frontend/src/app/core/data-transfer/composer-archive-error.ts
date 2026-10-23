import { HttpErrorResponse } from '@angular/common/http';

/** Angular returns JSON error responses as Blob when a successful download expects Blob. */
export async function composerArchiveErrorMessage(error: unknown): Promise<string> {
  if (!(error instanceof HttpErrorResponse)) {
    return 'Composer-Export fehlgeschlagen: Ein unerwarteter Fehler ist aufgetreten.';
  }
  if (error.status === 0) {
    return 'Composer-Export fehlgeschlagen: Der Server ist nicht erreichbar oder die Verbindung wurde unterbrochen.';
  }

  let payload: unknown = error.error;
  if (payload instanceof Blob) {
    try {
      payload = JSON.parse(await payload.text()) as unknown;
    } catch {
      payload = null;
    }
  }
  if (typeof payload === 'string') {
    try {
      payload = JSON.parse(payload) as unknown;
    } catch {
      // A plain-text server error can still provide a useful explanation.
    }
  }

  let detail: string | null = null;
  if (typeof payload === 'string') {
    detail = payload.trim() || null;
  } else if (payload !== null && typeof payload === 'object' && 'message' in payload) {
    const message = payload.message;
    if (typeof message === 'string') detail = message.trim() || null;
    else if (Array.isArray(message)) {
      detail = message.filter((item): item is string => typeof item === 'string').join('; ') || null;
    }
  }

  const fallback: Record<number, string> = {
    400: 'Die Exportdaten sind ungültig.',
    401: 'Die Anmeldung ist abgelaufen. Bitte erneut anmelden.',
    403: 'Du hast keine Berechtigung für diesen Export.',
    404: 'Ein Dokument oder ein verwendetes Asset wurde nicht gefunden.',
    413: 'Das Archiv überschreitet ein Größen- oder Anzahl-Limit.',
    500: 'Der Server konnte das Archiv nicht erstellen. Bitte die Serverlogs prüfen.',
    502: 'Der Backenddienst ist nicht erreichbar.',
    503: 'Der Backenddienst ist momentan nicht verfügbar.',
  };
  const reason = detail || fallback[error.status] || 'Unbekannter Serverfehler.';
  return `Composer-Export fehlgeschlagen (HTTP ${error.status}): ${reason.slice(0, 1200)}`;
}
