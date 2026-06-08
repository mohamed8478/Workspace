/**
 * JWT Utilities
 * Helper functions for JWT token operations
 */

/**
 * Decode JWT payload without verification
 * For display purposes only - never use for security decisions
 */
export function decodeJwt(token: string): Record<string, any> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    const decoded = JSON.parse(atob(parts[1]));
    return decoded;
  } catch (error) {
    return null;
  }
}

/**
 * Check if JWT is expired
 */
export function isJwtExpired(token: string): boolean {
  const decoded = decodeJwt(token);
  if (!decoded || !decoded['exp']) {
    return true;
  }

  const currentTime = Math.floor(Date.now() / 1000);
  return (decoded['exp'] as number) <= currentTime;
}

/**
 * Get time remaining until JWT expires
 */
export function getJwtTimeRemaining(token: string): number {
  const decoded = decodeJwt(token);
  if (!decoded || !decoded['exp']) {
    return 0;
  }

  const currentTime = Math.floor(Date.now() / 1000);
  return Math.max(0, (decoded['exp'] as number) - currentTime);
}
