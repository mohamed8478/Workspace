/**
 * Register Component
 * Professional two-column auth design with gradient left panel and form card
 * No OAuth integrations
 */

import { Component, ChangeDetectionStrategy, inject, signal, DestroyRef } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';
import { strongPasswordValidator, passwordMatchValidator } from '../../../shared/validators';
import { RegisterRequest } from '../../../shared/models';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './register.component.html',
  styleUrl: './register.component.css'
})
export class RegisterComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  form: FormGroup;
  isLoading = signal(false);
  showPassword = signal(false);
  passwordStrength = signal(0);

  constructor() {
    this.form = this.fb.group(
      {
        firstName: ['', Validators.required],
        lastName: ['', Validators.required],
        email: ['', [Validators.required, Validators.email]],
        password: ['', [Validators.required, strongPasswordValidator()]],
        confirmPassword: ['', Validators.required],
        agreeTerms: [false, Validators.requiredTrue]
      },
      { validators: passwordMatchValidator() }
    );

    // Update password strength on password input changes
    this.form.get('password')?.valueChanges.subscribe(() => {
      this.updatePasswordStrength();
    });
  }

  /**
   * Update password strength indicator
   */
  private updatePasswordStrength(): void {
    const password = this.form.get('password')?.value || '';
    let score = 0;
    
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    
    this.passwordStrength.set(score);
  }

  /**
   * Get password strength label
   */
  getPasswordStrengthLabel(): string {
    const labels = ['', 'Weak', 'Fair', 'Good', 'Strong'];
    return labels[this.passwordStrength()] || '';
  }

  /**
   * Get password strength color
   */
  getPasswordStrengthColor(): string {
    const colors = ['', '#f87171', '#fbbf24', '#60d394', '#22d3a0'];
    return colors[this.passwordStrength()] || '';
  }

  /**
   * Submit register form
   */
  onSubmit(): void {
    if (this.form.invalid) return;

    this.isLoading.set(true);
    const request: RegisterRequest = {
      firstName: this.form.get('firstName')?.value,
      lastName: this.form.get('lastName')?.value,
      username: this.form.get('email')?.value,
      password: this.form.get('password')?.value
    };

    this.authService.register(request)
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
