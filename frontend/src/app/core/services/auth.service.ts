/**
 * Auth Service
 * Orchestrates login/logout/refresh flow
 * Manages authentication state and user info
 * Uses BehaviorSubject for state management
 */

import { Injectable, inject, DestroyRef } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError } from 'rxjs';
import { tap, catchError, map } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthApiService } from '../../api/auth-api.service';
import { TokenService } from './token.service';
import { NotificationService } from './notification.service';
import { JwtPayload, LoginRequest, RegisterRequest, UserInfo } from '../../shared/models';
import { ChatWsService } from '../../features/chat/services/chat-ws.service';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly authApiService = inject(AuthApiService);
  private readonly tokenService = inject(TokenService);
  private readonly notificationService = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);
  private readonly chatWsService = inject(ChatWsService);

  private currentUserSubject = new BehaviorSubject<UserInfo | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  private isAuthenticatedSubject = new BehaviorSubject<boolean>(false);
  public isAuthenticated$ = this.isAuthenticatedSubject.asObservable();

  constructor() {
    this.initializeAuthState();
  }

  /**
   * Initialize auth state on app startup
   */
  private initializeAuthState(): void {
    if (this.tokenService.hasValidToken()) {
      const payload = this.tokenService.decodePayload();
      if (payload) {
        this.currentUserSubject.next(this.userFromPayload(payload));
        this.isAuthenticatedSubject.next(true);

        // Reconnect WebSocket on page refresh
        const token = this.tokenService.getAccessToken();
        if (token) {
          this.chatWsService.connect(token);
        }
      }
    }
  }

  /**
   * Get current user value (synchronously)
   */
  getCurrentUser(): UserInfo | null {
    return this.currentUserSubject.getValue();
  }

  /**
   * Check if authenticated (synchronously)
   */
  isAuthenticated(): boolean {
    return this.isAuthenticatedSubject.getValue();
  }

  /**
   * Login user with email and password
   */
  login(credentials: LoginRequest): Observable<void> {
    return this.authApiService.login(credentials).pipe(
      tap(response => {
        this.tokenService.saveTokens(response.accessToken, response.refreshToken);
        this.chatWsService.connect(response.accessToken);
        const payload = this.tokenService.decodePayload();
        if (payload) {
          this.currentUserSubject.next(this.normalizeUser(response.user, payload));
          this.isAuthenticatedSubject.next(true);
        }

        this.notificationService.success('Login successful');
        this.router.navigate(['/dashboard']);
      }),
      map(() => undefined),
      catchError(error => {
        const message = error.error?.message || 'Login failed';
        this.notificationService.error(message);
        return throwError(() => error);
      }),
      takeUntilDestroyed(this.destroyRef)
    );
  }

  /**
   * Register new user
   */
  register(credentials: RegisterRequest): Observable<void> {
    return this.authApiService.register(credentials).pipe(
      tap(response => {
        this.tokenService.saveTokens(response.accessToken, response.refreshToken);
        
        if (response.user) {
          this.currentUserSubject.next(response.user);
          this.isAuthenticatedSubject.next(true);
        }

        this.notificationService.success('Registration successful');
        this.router.navigate(['/dashboard']);
      }),
      map(() => undefined),
      catchError(error => {
        const message = error.error?.message || 'Registration failed';
        this.notificationService.error(message);
        return throwError(() => error);
      }),
      takeUntilDestroyed(this.destroyRef)
    );
  }

  /**
   * Refresh access token
   */
  refreshAccessToken(): Observable<{ accessToken: string }> {
    const refreshToken = this.tokenService.getRefreshToken();
    if (!refreshToken) {
      return throwError(() => new Error('No refresh token available'));
    }

    return this.authApiService.refreshToken(refreshToken).pipe(
      tap(response => {
        this.tokenService.saveTokens(response.accessToken, refreshToken);
      }),
      catchError(error => {
        this.logout();
        return throwError(() => error);
      }),
      takeUntilDestroyed(this.destroyRef)
    );
  }

  /**
   * Logout user
   */
  logout(): void {
    this.authApiService.logout().pipe(
      tap(() => {
        this.clearAuthState();
        this.chatWsService.disconnect();
        this.notificationService.success('Logged out successfully');
        this.router.navigate(['/auth/login']);
      }),
      catchError(() => {
        // Still clear auth state even if logout fails
        this.clearAuthState();
        this.router.navigate(['/auth/login']);
        return throwError(() => new Error('Logout failed'));
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe();
  }

  /**
   * Clear all auth state
   */
  private clearAuthState(): void {
    this.tokenService.clearTokens();
    this.currentUserSubject.next(null);
    this.isAuthenticatedSubject.next(false);
  }

  /**
   * Request password reset
   */
  requestPasswordReset(email: string): Observable<void> {
    return this.authApiService.requestPasswordReset(email).pipe(
      tap(() => {
        // Show success message regardless of whether email exists (security best practice)
        this.notificationService.success('If an account with this email exists, you will receive password reset instructions');
      }),
      catchError(error => {
        this.notificationService.error('Failed to request password reset');
        return throwError(() => error);
      }),
      takeUntilDestroyed(this.destroyRef)
    );
  }

  /**
   * Get user roles
   */
  getRoles(): string[] {
    const payload = this.tokenService.decodePayload();
    return payload?.roles || [];
  }

  /**
   * Check if user has a specific role
   */
  hasRole(role: string): boolean {
    return this.getRoles().includes(role);
  }

  /**
   * Check if user has any of the given roles
   */
  hasAnyRole(roles: string[]): boolean {
    return roles.some(role => this.hasRole(role));
  }

  private normalizeUser(user: UserInfo | undefined, payload: JwtPayload): UserInfo {
    if (user) {
      const fullName = user.fullName || [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
      const nameParts = this.splitFullName(fullName);

      return {
        ...user,
        id: user.id || payload.userId || payload.sub,
        email: user.email || payload.email,
        fullName,
        firstName: user.firstName || nameParts.firstName,
        lastName: user.lastName || nameParts.lastName,
        roles: user.roles?.length ? user.roles : payload.roles || [],
      };
    }

    return this.userFromPayload(payload);
  }

  private userFromPayload(payload: JwtPayload): UserInfo {
    const nameParts = this.splitFullName(payload.fullName);

    return {
      id: payload.userId || payload.sub,
      email: payload.email,
      fullName: payload.fullName || '',
      firstName: nameParts.firstName,
      lastName: nameParts.lastName,
      roles: payload.roles || [],
    };
  }

  private splitFullName(fullName?: string): Pick<UserInfo, 'firstName' | 'lastName'> {
    const parts = fullName?.trim().split(/\s+/).filter(Boolean) ?? [];

    return {
      firstName: parts[0] ?? '',
      lastName: parts.slice(1).join(' '),
    };
  }
}
