/**
 * Dashboard Component
 * Protected page shown after login
 * Displays user info and logout button
 */

import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dashboard">
      <div class="dashboard-header">
        <div class="header-content">
          <h1 class="dashboard-title">Dashboard</h1>
          <p class="dashboard-subtitle">Welcome to your dashboard</p>
        </div>
        <button (click)="logout()" class="logout-button">Logout</button>
      </div>

      <div class="dashboard-content">
        <div class="welcome-card">
          <h2 class="card-title">Welcome Back!</h2>
          @let user = (currentUser$ | async);
          @if (user) {
            <p class="card-text">
              Hello, <strong>{{ user.firstName }} {{ user.lastName }}</strong>
            </p>
            <div class="user-info">
              <div class="info-item">
                <span class="info-label">Email:</span>
                <span class="info-value">{{ user.email }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">User ID:</span>
                <span class="info-value">{{ user.id }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Roles:</span>
                <span class="info-value">{{ user.roles.join(', ') }}</span>
              </div>
            </div>
          }
          <p class="card-description">
            You have successfully logged in. This is a protected page that requires authentication.
          </p>
          <button (click)="startMeeting()" class="start-meeting-button">
            📹 Start Video Meeting
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .dashboard {
      min-height: 100vh;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 2rem 1rem;
    }

    .dashboard-header {
      max-width: 1200px;
      margin: 0 auto 2rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .header-content {
      color: white;
    }

    .dashboard-title {
      font-size: 2.25rem;
      font-weight: 700;
      margin: 0 0 0.5rem 0;
    }

    .dashboard-subtitle {
      font-size: 1rem;
      opacity: 0.9;
      margin: 0;
    }

    .logout-button {
      padding: 0.75rem 1.5rem;
      background: white;
      color: #667eea;
      border: none;
      border-radius: 6px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .logout-button:hover {
      transform: translateY(-2px);
      box-shadow: 0 10px 20px rgba(0, 0, 0, 0.2);
    }

    .dashboard-content {
      max-width: 1200px;
      margin: 0 auto;
    }

    .welcome-card {
      background: white;
      border-radius: 8px;
      padding: 2rem;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
    }

    .card-title {
      font-size: 1.5rem;
      font-weight: 700;
      color: #1f2937;
      margin: 0 0 1rem 0;
    }

    .card-text {
      font-size: 1.125rem;
      color: #374151;
      margin: 0 0 1.5rem 0;
    }

    .user-info {
      background: #f9fafb;
      border-radius: 6px;
      padding: 1.5rem;
      margin: 1.5rem 0;
      border-left: 4px solid #667eea;
    }

    .info-item {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 0.5rem 0;
    }

    .info-label {
      font-weight: 600;
      color: #6b7280;
      min-width: 80px;
    }

    .info-value {
      color: #1f2937;
      word-break: break-all;
    }

    .card-description {
      font-size: 0.875rem;
      color: #6b7280;
      line-height: 1.6;
      margin: 0 0 1.5rem 0;
    }

    .start-meeting-button {
      width: 100%;
      padding: 1rem;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      border-radius: 6px;
      font-weight: 600;
      font-size: 1rem;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .start-meeting-button:hover {
      transform: translateY(-2px);
      box-shadow: 0 10px 25px rgba(102, 126, 234, 0.4);
    }

    .start-meeting-button:active {
      transform: translateY(0);
    }

    @media (max-width: 768px) {
      .dashboard-header {
        flex-direction: column;
        gap: 1rem;
        align-items: flex-start;
      }

      .logout-button {
        width: 100%;
      }

      .dashboard-title {
        font-size: 1.5rem;
      }
    }
  `]
})
export class DashboardComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  currentUser$ = this.authService.currentUser$;

  /**
   * Logout user
   */
  logout(): void {
    this.authService.logout();
  }

  /**
   * Navigate to LiveKit video meeting lobby
   */
  startMeeting(): void {
    this.router.navigate(['/livekit']);
  }
}
