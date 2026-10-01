/**
 * Authentication storage helper
 * In production: Refresh tokens are NEVER stored in localStorage (HttpOnly cookie only).
 * In development: Optional fallback for cross-origin/cross-port local dev if needed.
 */

export const isDev = Boolean((import.meta as any).env?.DEV);

export function saveTokens(accessToken?: string | null, refreshToken?: string | null) {
  if (accessToken) {
    localStorage.setItem('academy_access_token', accessToken);
  }
  // In production builds, NEVER persist refresh token to localStorage
  if (refreshToken && isDev) {
    localStorage.setItem('academy_refresh_token', refreshToken);
  }
}

export function getDevRefreshToken(): string | null {
  if (!isDev) return null;
  return localStorage.getItem('academy_refresh_token');
}

export function clearAuthStorage() {
  localStorage.removeItem('academy_access_token');
  localStorage.removeItem('academy_refresh_token');
  localStorage.removeItem('academy_user');
}
