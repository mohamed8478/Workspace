/**
 * Token Service
 * Single place for JWT token management
 * Handles: read, write, decode, expiration check
 * Uses localStorage for token persistence
 */

import { Injectable } from '@angular/core';
import { JwtPayload } from '../../shared/models';

@Injectable({
  providedIn: 'root'
})
export class TokenService {
  private readonly ACCESS_TOKEN_KEY = 'access_token';
  private readonly REFRESH_TOKEN_KEY = 'refresh_token';

  /**
   * Save both access and refresh tokens to localStorage
   */
  saveTokens(accessToken: string, refreshToken: string): void {
    localStorage.setItem(this.ACCESS_TOKEN_KEY, accessToken);
    localStorage.setItem(this.REFRESH_TOKEN_KEY, refreshToken);
  }

  /**
   * Get access token from localStorage
   */
  getAccessToken(): string | null {
    return localStorage.getItem(this.ACCESS_TOKEN_KEY);
  }

  /**
   * Get refresh token from localStorage
   */
  getRefreshToken(): string | null {
    return localStorage.getItem(this.REFRESH_TOKEN_KEY);
  }

  /**
   * Clear both tokens from localStorage
   */
  clearTokens(): void {
    localStorage.removeItem(this.ACCESS_TOKEN_KEY);
    localStorage.removeItem(this.REFRESH_TOKEN_KEY);
  }

  /**
   * Decode JWT payload without verification (for display only)
   * Never use for security decisions
   */
  decodePayload(): JwtPayload | null {
    const token = this.getAccessToken();

    if (!token) {
      return null;
    }

    try {
      const parts = token.split('.');

      if (parts.length !== 3) {
        return null;
      }

      const decoded = JSON.parse(atob(parts[1]));

      return decoded as JwtPayload;
    } catch (error) {
      return null;
    }
  }

  /**
   * Check if access token is expired
   */
  isTokenExpired(): boolean {
    const payload = this.decodePayload();

    if (!payload || !payload.exp) {
      return true;
    }

    const currentTime = Math.floor(Date.now() / 1000);

    return payload.exp <= currentTime;
  }

  /**
   * Check if we have a valid token
   */
  hasValidToken(): boolean {
    return !!this.getAccessToken() && !this.isTokenExpired();
  }
}