/**
 * Auth Guard
 * Protects routes that require authentication
 * Redirects unauthenticated users to login
 */

import { Injectable, inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { TokenService } from '../services/token.service';

export const authGuard: CanActivateFn = (route, state) => {
  const tokenService = inject(TokenService);
  const router = inject(Router);

  if (tokenService.hasValidToken()) {
    return true;
  }

  router.navigate(['/auth/login']);
  return false;
};
