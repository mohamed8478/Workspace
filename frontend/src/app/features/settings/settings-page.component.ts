import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { AuthService } from '../../core/services/auth.service';
import { TokenService } from '../../core/services/token.service';
import { UserInfo } from '../../shared/models';

@Component({
  selector: 'app-settings-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './settings-page.component.html',
  styleUrl: './settings-page.component.css',
})
export class SettingsPageComponent {
  private readonly authService = inject(AuthService);
  private readonly tokenService = inject(TokenService);

  readonly currentUser = toSignal(this.authService.currentUser$, { initialValue: null });
  readonly tokenPayload = this.tokenService.decodePayload();

  readonly displayName = computed(() => {
    const user = this.currentUser();
    const fullName = this.fullName(user);

    return fullName || this.tokenPayload?.fullName || user?.email || this.tokenPayload?.email || 'Workspace user';
  });

  readonly initials = computed(() => {
    const name = this.displayName().trim();
    const words = name.split(/\s+/).filter(Boolean);

    if (words.length >= 2) {
      return `${words[0][0]}${words[1][0]}`.toUpperCase();
    }

    return name.slice(0, 2).toUpperCase();
  });

  readonly email = computed(() => this.currentUser()?.email || this.tokenPayload?.email || 'No email available');
  readonly userId = computed(() => this.currentUser()?.id || this.tokenPayload?.userId || this.tokenPayload?.sub || 'Unknown');
  readonly roles = computed(() => {
    const roles = this.currentUser()?.roles?.length
      ? this.currentUser()?.roles
      : this.tokenPayload?.roles;

    return roles?.length ? roles : ['USER'];
  });

  logout(): void {
    this.authService.logout();
  }

  private fullName(user: UserInfo | null): string {
    return user?.fullName || [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim();
  }
}
