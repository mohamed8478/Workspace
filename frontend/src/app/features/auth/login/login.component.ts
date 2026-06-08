/**
 * Login Component
 * Professional two-column auth design with gradient left panel and form card
 * No OAuth integrations
 */

import { Component, ChangeDetectionStrategy, inject, signal, DestroyRef } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';
import { LoginRequest } from '../../../shared/models';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  form: FormGroup;
  isLoading = signal(false);
  showPassword = signal(false);
  rememberMe = signal(false);

  constructor() {
    this.form = this.fb.group({
      username: ['', Validators.required],
      password: ['', Validators.required],
      remember: [false]
    });
  }

  /**
   * Submit login form
   */
  onSubmit(): void {
    if (this.form.invalid) return;

    this.isLoading.set(true);
    const request: LoginRequest = {
      username: this.form.get('username')?.value,
      password: this.form.get('password')?.value
    };

    this.authService.login(request)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        error: () => this.isLoading.set(false),
        complete: () => this.isLoading.set(false)
      });
  }

  /**
   * Toggle password visibility
   */
  togglePasswordVisibility(): void {
    this.showPassword.update(v => !v);
  }

  /**
   * Check if field has validation errors and is touched
   */
  isFieldInvalid(fieldName: string): boolean {
    const field = this.form.get(fieldName);
    return !!(field && field.invalid && field.touched);
  }
}
