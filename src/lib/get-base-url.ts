/**
 * Base URL Utility
 *
 * Centralized utility for getting the application's base URL.
 * Replaces 9+ scattered `localhost:3000` fallbacks across the codebase.
 *
 * In production: NEXTAUTH_URL must be set (throws if missing)
 * In development: Falls back to http://localhost:3000
 */

/**
 * Get the base URL for internal API calls
 *
 * @throws Error if NEXTAUTH_URL not set in production
 * @returns Base URL string (e.g., "https://anoa.app" or "http://localhost:3000")
 */
export function getBaseUrl(): string {
  const url = process.env.NEXTAUTH_URL;

  if (url) {
    // Remove trailing slash for consistency
    return url.replace(/\/$/, '');
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'NEXTAUTH_URL must be configured in production. Set it in .env (e.g., https://anoa.app)'
    );
  }

  // Development fallback only
  return 'http://localhost:3000';
}
