/**
 * Error Interceptor
 * Global HTTP error handler
 * Handles 401, 403, 500 errors and displays notifications
 */

import { Injectable, inject } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { NotificationService } from '../services/notification.service';
import { Router } from '@angular/router';

@Injectable()
export class ErrorInterceptor implements HttpInterceptor {
  private readonly notificationService = inject(NotificationService);
  private readonly router = inject(Router);

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    return next.handle(request).pipe(
      catchError((error: HttpErrorResponse) => {
        this.handleError(error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Handle different HTTP error responses
   */
  private handleError(error: HttpErrorResponse): void {
    let message = 'An error occurred';

    if (error.status === 0) {
      message = 'Connection error. Please check your internet connection.';
    } else if (error.status === 400) {
      message = error.error?.message || 'Bad request';
    } else if (error.status === 401) {
      message = 'Unauthorized. Please login again.';
    } else if (error.status === 403) {
      message = error.error?.message || 'Access forbidden. You do not have permission to access this resource.';
    } else if (error.status === 404) {
      message = 'Resource not found.';
    } else if (error.status === 409) {
      message = error.error?.message || 'Conflict. The request conflicts with existing data.';
    } else if (error.status >= 500) {
      message = 'Server error. Please try again later.';
    } else if (error.error?.message) {
      message = error.error.message;
    }

    this.notificationService.error(message);
  }
}
