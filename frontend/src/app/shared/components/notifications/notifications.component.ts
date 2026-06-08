/**
 * Global Notifications Component
 * Displays toast notifications for success, error, warning, and info messages
 */

import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NotificationService } from '../../../core/services/notification.service';
import type { Notification } from '../../../core/services/notification.service';

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="notifications-container">
      @for (notification of notifications$ | async; track notification.id) {
        <div
          class="notification"
          [class]="'notification--' + notification.type"
        >
          <div class="notification-content">
            <span class="notification-icon">
              @switch (notification.type) {
                @case ('success') {
                  ✓
                }
                @case ('error') {
                  ✕
                }
                @case ('warning') {
                  ⚠
                }
                @default {
                  ℹ
                }
              }
            </span>
            <span class="notification-message">{{ notification.message }}</span>
          </div>
          <button
            class="notification-close"
            (click)="closeNotification(notification.id)"
            aria-label="Close notification"
          >
            ×
          </button>
        </div>
      }
    </div>
  `,
  styles: [`
    .notifications-container {
      position: fixed;
      bottom: 1rem;
      right: 1rem;
      z-index: 10000;
      max-width: 400px;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .notification {
      background: white;
      border-radius: 6px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      padding: 1rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      min-height: 50px;
      border-left: 4px solid;
      animation: slideIn 300ms ease-out;
    }

    @keyframes slideIn {
      from {
        transform: translateX(400px);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }

    @keyframes slideOut {
      from {
        transform: translateX(0);
        opacity: 1;
      }
      to {
        transform: translateX(400px);
        opacity: 0;
      }
    }

    .notification-content {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      flex: 1;
    }

    .notification-icon {
      font-size: 1.25rem;
      font-weight: bold;
      flex-shrink: 0;
    }

    .notification-message {
      font-size: 0.875rem;
      color: #374151;
      line-height: 1.4;
    }

    .notification-close {
      background: none;
      border: none;
      font-size: 1.5rem;
      cursor: pointer;
      color: #9ca3af;
      padding: 0;
      margin-left: 1rem;
      flex-shrink: 0;
      transition: color 0.2s ease;
    }

    .notification-close:hover {
      color: #6b7280;
    }

    .notification--success {
      border-left-color: #10b981;
      background: #f0fdf4;
    }

    .notification--success .notification-icon {
      color: #10b981;
    }

    .notification--success .notification-message {
      color: #047857;
    }

    .notification--error {
      border-left-color: #ef4444;
      background: #fef2f2;
    }

    .notification--error .notification-icon {
      color: #ef4444;
    }

    .notification--error .notification-message {
      color: #dc2626;
    }

    .notification--warning {
      border-left-color: #f59e0b;
      background: #fffbeb;
    }

    .notification--warning .notification-icon {
      color: #f59e0b;
    }

    .notification--warning .notification-message {
      color: #d97706;
    }

    .notification--info {
      border-left-color: #3b82f6;
      background: #eff6ff;
    }

    .notification--info .notification-icon {
      color: #3b82f6;
    }

    .notification--info .notification-message {
      color: #1e40af;
    }

    @media (max-width: 480px) {
      .notifications-container {
        left: 1rem;
        right: 1rem;
        max-width: none;
      }
    }
  `]
})
export class NotificationsComponent {
  private readonly notificationService = inject(NotificationService);

  notifications$ = this.notificationService.notifications$;

  /**
   * Close notification
   */
  closeNotification(id: string): void {
    this.notificationService.remove(id);
  }
}
