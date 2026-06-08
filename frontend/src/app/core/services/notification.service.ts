/**
 * Notification Service
 * Centralized toast/snackbar messaging for the app
 * Uses BehaviorSubject to broadcast notifications
 */

import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface Notification {
  readonly id: string;
  readonly message: string;
  readonly type: 'success' | 'error' | 'warning' | 'info';
  readonly duration?: number;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private notificationSubject = new BehaviorSubject<Notification | null>(null);
  public notification$: Observable<Notification | null> = this.notificationSubject.asObservable();

  private notificationListSubject = new BehaviorSubject<Notification[]>([]);
  public notifications$: Observable<Notification[]> = this.notificationListSubject.asObservable();

  /**
   * Show success notification
   */
  success(message: string, duration: number = 3000): void {
    this.show(message, 'success', duration);
  }

  /**
   * Show error notification
   */
  error(message: string, duration: number = 5000): void {
    this.show(message, 'error', duration);
  }

  /**
   * Show warning notification
   */
  warning(message: string, duration: number = 4000): void {
    this.show(message, 'warning', duration);
  }

  /**
   * Show info notification
   */
  info(message: string, duration: number = 3000): void {
    this.show(message, 'info', duration);
  }

  /**
   * Generic show notification
   */
  private show(message: string, type: 'success' | 'error' | 'warning' | 'info', duration: number): void {
    const notification: Notification = {
      id: Date.now().toString(),
      message,
      type,
      duration
    };

    this.notificationSubject.next(notification);

    const notifications = this.notificationListSubject.getValue();
    this.notificationListSubject.next([...notifications, notification]);

    if (duration > 0) {
      setTimeout(() => this.remove(notification.id), duration);
    }
  }

  /**
   * Remove notification by id
   */
  remove(id: string): void {
    const notifications = this.notificationListSubject.getValue();
    this.notificationListSubject.next(notifications.filter(n => n.id !== id));
  }

  /**
   * Clear all notifications
   */
  clear(): void {
    this.notificationListSubject.next([]);
  }
}
