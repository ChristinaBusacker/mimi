import type { CookieOptions, Request, Response } from 'express';

export const AUTH_SESSION_COOKIE = 'mimi_session';

function getCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
    secure: process.env['NODE_ENV'] === 'production',
  };
}

export function readSessionCookie(request: Request): string | null {
  const cookieHeader = request.headers.cookie;

  if (!cookieHeader) {
    return null;
  }

  for (const cookie of cookieHeader.split(';')) {
    const separatorIndex = cookie.indexOf('=');

    if (separatorIndex < 0) {
      continue;
    }

    const name = cookie.slice(0, separatorIndex).trim();

    if (name !== AUTH_SESSION_COOKIE) {
      continue;
    }

    const value = cookie.slice(separatorIndex + 1).trim();

    return value || null;
  }

  return null;
}

export function setSessionCookie(
  response: Response,
  token: string,
  expiresAt: Date,
): void {
  response.cookie(AUTH_SESSION_COOKIE, token, {
    ...getCookieOptions(),
    expires: expiresAt,
  });
}

export function clearSessionCookie(response: Response): void {
  response.clearCookie(AUTH_SESSION_COOKIE, getCookieOptions());
}
