/**
 * No Auth Guard
 * Redirects authenticated users away from login/register pages
 */

import { Injectable, inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { TokenService } from '../services/token.service';

export const noAuthGuard: CanActivateFn = (route, state) => {
  const tokenService = inject(TokenService);
  const router = inject(Router);

  if (tokenService.hasValidToken()) {
    router.navigate(['/dashboard']);
    return false;
  }

  return true;
};
