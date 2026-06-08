/**
 * Role Guard
 * Checks if user has required roles
 * Reads roles from JWT payload via TokenService
 */

import { Injectable, inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot } from '@angular/router';
import { TokenService } from '../services/token.service';
import { NotificationService } from '../services/notification.service';

export const roleGuard: CanActivateFn = (route: ActivatedRouteSnapshot, state) => {
  const tokenService = inject(TokenService);
  const router = inject(Router);
  const notificationService = inject(NotificationService);

  const requiredRoles: string[] = route.data['roles'] || [];

  if (!requiredRoles.length) {
    return true;
  }

  const payload = tokenService.decodePayload();
  if (!payload) {
    router.navigate(['/auth/login']);
    return false;
  }

  const userRoles = payload.roles || [];
  const hasRequiredRole = requiredRoles.some(role => userRoles.includes(role));

  if (!hasRequiredRole) {
    notificationService.error('You do not have permission to access this page');
    router.navigate(['/dashboard']);
    return false;
  }

  return true;
};
