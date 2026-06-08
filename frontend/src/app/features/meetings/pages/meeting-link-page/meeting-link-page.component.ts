import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin, interval } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Meeting } from '../../models/meeting.model';
import { MeetingApiService, MeetingResponse } from '../../services/meeting.api.service';
import { LivekitRoomService } from '../../../livekit/services/livekit-room.service';
import { environment } from '../../../../../environments/environment';

type MeetingLinkMeeting = Meeting | MeetingResponse;

interface CountdownParts {
  readonly days: number;
  readonly hours: number;
  readonly minutes: number;
  readonly seconds: number;
  readonly totalMs: number;
}

@Component({
  selector: 'app-meeting-link-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './meeting-link-page.component.html',
  styleUrl: './meeting-link-page.component.css',
})
export class MeetingLinkPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly meetingApiService = inject(MeetingApiService);
  private readonly roomService = inject(LivekitRoomService);
  private meetingId: number | null = null;
  private lastStatusRefresh = 0;

  readonly loading = signal(true);
  readonly joining = signal(false);
  readonly error = signal<string | null>(null);
  readonly meeting = signal<MeetingLinkMeeting | null>(null);
  readonly countdown = signal<CountdownParts>({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    totalMs: 0,
  });
  readonly dateLabel = computed(() => {
    const startTime = this.meeting()?.startTime;

    if (!startTime) {
      return 'Date pending';
    }

    return new Date(startTime).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  });
  readonly statusLabel = computed(() =>
    this.countdown().totalMs <= 10 * 60 * 1000 ? 'Starting Imminently' : 'Starting Soon'
  );

  ngOnInit(): void {
    const meetingId = Number(this.route.snapshot.paramMap.get('meetingId'));

    if (!Number.isInteger(meetingId) || meetingId <= 0) {
      this.loading.set(false);
      this.error.set('This meeting link is not valid.');
      return;
    }

    this.meetingId = meetingId;
    this.loadMeetingState(meetingId);

    interval(1000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.updateCountdown();

        if (
          this.countdown().totalMs === 0 &&
          !this.joining() &&
          Date.now() - this.lastStatusRefresh > 5000
        ) {
          this.loadMeetingState(meetingId, true);
        }
      });
  }

  formatPart(value: number): string {
    return value.toString().padStart(2, '0');
  }

  retry(): void {
    if (this.meetingId) {
      this.loadMeetingState(this.meetingId);
    }
  }

  private loadMeetingState(meetingId: number, silent = false): void {
    this.lastStatusRefresh = Date.now();
    this.error.set(null);

    if (!silent) {
      this.loading.set(true);
    }

    forkJoin({
      meetings: this.meetingApiService.getMeetings(),
      activeMeetings: this.meetingApiService.getActiveMeetings(),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ meetings, activeMeetings }) => {
          const activeMeeting = activeMeetings.find((meeting) => meeting.id === meetingId);
          const meeting = activeMeeting ?? meetings.find((item) => item.id === meetingId) ?? null;

          if (!meeting) {
            this.loading.set(false);
            this.error.set('We could not find this meeting.');
            return;
          }

          this.meeting.set(meeting);
          this.updateCountdown();

          if (activeMeeting || this.isActiveMeeting(meeting)) {
            this.joinMeeting(meeting.id);
            return;
          }

          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.error.set('We could not load this meeting link. Please try again.');
        },
      });
  }

  private joinMeeting(meetingId: number): void {
    if (this.joining()) {
      return;
    }

    this.joining.set(true);
    this.loading.set(false);

    this.meetingApiService
      .getToken(meetingId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: async (response) => {
          await this.roomService.connect(environment.livekitUrl, response.token, response.roomName, response.meetingId);
          void this.router.navigate(['/livekit/room']);
        },
        error: () => {
          this.joining.set(false);
          this.error.set('The meeting is almost ready. We will keep checking for you.');
        },
      });
  }

  private updateCountdown(): void {
    const startTime = this.meeting()?.startTime;
    const totalMs = startTime
      ? Math.max(0, new Date(startTime).getTime() - Date.now())
      : 0;

    const totalSeconds = Math.floor(totalMs / 1000);
    const days = Math.floor(totalSeconds / 86_400);
    const hours = Math.floor((totalSeconds % 86_400) / 3_600);
    const minutes = Math.floor((totalSeconds % 3_600) / 60);
    const seconds = totalSeconds % 60;

    this.countdown.set({ days, hours, minutes, seconds, totalMs });
  }

  private isActiveMeeting(meeting: MeetingLinkMeeting): boolean {
    return 'status' in meeting && meeting.status === 'ACTIVE';
  }
}
