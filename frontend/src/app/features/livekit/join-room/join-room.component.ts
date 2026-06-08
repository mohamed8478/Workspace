/**
 * Join Room Component (Lobby)
 * Allows users to enter their name and select a room
 * OnPush change detection for performance
 */
import {
  Component,
  inject,
  signal,
  DestroyRef,
  ChangeDetectionStrategy,
} from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LivekitApiService } from '../../../api/livekit-api.service';
// import { LivekitRoomService } from '../../../core/services/livekit-room.service';
import { environment } from '../../../../environments/environment';
import { LivekitRoomService } from '../services/livekit-room.service';

// LiveKit server URL - should be in environment
const LIVEKIT_URL = environment.livekitUrl;

@Component({
  selector: 'app-join-room',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './join-room.component.html',
  styleUrl: './join-room.component.css',
})
export class JoinRoomComponent {
  private readonly fb = inject(FormBuilder);
  private readonly apiService = inject(LivekitApiService);
  private readonly roomService = inject(LivekitRoomService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly form = this.fb.group({
    roomName: ['', [Validators.required]],
    participantName: ['', [Validators.required]],
  });

  /**
   * Join the room with entered credentials
   */
  join(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      this.error.set('Room name and participant name are required');
      return;
    }

    const { roomName, participantName } = this.form.getRawValue();
    if (!roomName || !participantName) {
      this.error.set('Room name and participant name are required');
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    this.apiService
      .getToken({ roomName, participantName })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: async (response: { token: string }) => {
          try {
            await this.roomService.connect(LIVEKIT_URL, response.token, roomName);
            this.loading.set(false);
            this.router.navigate(['/livekit/room']);
          } catch (err: any) {
            this.error.set(
              err?.message ?? 'Failed to connect to room'
            );
            this.loading.set(false);
          }
        },
        error: (err: any) => {
          this.error.set(
            err?.error?.errorMessage ?? 'Failed to get access token'
          );
          this.loading.set(false);
        },
      });
  }

  /**
   * Check if form field has error and is touched
   */
  getFieldError(fieldName: 'roomName' | 'participantName'): string | null {
    const field = this.form.get(fieldName);
    if (!field || !field.touched) return null;

    if (field.hasError('required')) {
      return fieldName === 'roomName'
        ? 'Room name is required'
        : 'Participant name is required';
    }

    return null;
  }
}
