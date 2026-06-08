import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterOutlet, RouterLinkWithHref, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { catchError, filter, forkJoin, map, of, switchMap, timer } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ChatService } from '../../../features/chat/services/chat.service';
import { ChatWsService } from '../../../features/chat/services/chat-ws.service';
import { MeetingApiService, MeetingResponse } from '../../../features/meetings/services/meeting.api.service';
import { TokenService } from '../../../core/services/token.service';

@Component({
  selector: 'app-main-layouts',
  imports: [RouterOutlet, RouterLinkWithHref ,RouterLinkActive],
  templateUrl: './main-layouts.component.html',
  styleUrl: './main-layouts.component.css'
  // styleUrl: '../../../shared/style/chat.css'
})
export class MainLayoutsComponent implements OnInit {
  private static readonly SEEN_SCHEDULED_MEETINGS_KEY = 'workspace.seenScheduledMeetingIds';

  private router = inject(Router);
  private readonly chatService = inject(ChatService);
  private readonly chatWsService = inject(ChatWsService);
  private readonly tokenService = inject(TokenService);
  private readonly meetingApiService = inject(MeetingApiService);
  private readonly destroyRef = inject(DestroyRef);
  readonly unreadMessageCount = this.chatService.totalUnreadCount;
  readonly liveMeetingCount = signal(0);
  readonly scheduledMeetingNotificationCount = signal(0);
  private readonly upcomingMeetings = signal<MeetingResponse[]>([]);
  private seenScheduledMeetingIds = this.readSeenScheduledMeetingIds();

private currentUrl = toSignal(
    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd),
      map(e => (e as NavigationEnd).urlAfterRedirects)
    ),
    { initialValue: this.router.url }
  );

  isMeetingsActive = computed(() => {
    const url = this.currentUrl();
    return url.startsWith('/dashboard/meeting') || url.startsWith('/dashboard/create');
  });

  isTasksActive = computed(() => {
    const url = this.currentUrl();
    return url.startsWith('/dashboard/tasks');
  });

  isReportsActive = computed(() => {
    const url = this.currentUrl();
    return url.startsWith('/dashboard/reports');
  });

  ngOnInit(): void {
    this.startChatRealtimeConnection();
    this.chatService.ensureChatsLoaded();
    this.startMeetingNotificationPolling();
    this.clearScheduledNotificationsWhenEnteringMeetings();
  }

  formatBadgeCount(count: number): string {
    return count > 99 ? '99+' : `${count}`;
  }

  private startMeetingNotificationPolling(): void {
    timer(0, 10000)
      .pipe(
        switchMap(() =>
          forkJoin({
            active: this.meetingApiService.getActiveMeetings().pipe(
              catchError(() => of([] as MeetingResponse[]))
            ),
            upcoming: this.meetingApiService.getUpcomingMeetings().pipe(
              catchError(() => of([] as MeetingResponse[]))
            )
          })
        ),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(({ active, upcoming }) => {
        this.liveMeetingCount.set(active.length);
        this.updateScheduledMeetingNotifications(upcoming);
      });
  }

  private clearScheduledNotificationsWhenEnteringMeetings(): void {
    this.router.events
      .pipe(
        filter(event => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(event => {
        const url = (event as NavigationEnd).urlAfterRedirects;
        if (this.isMeetingListUrl(url)) {
          this.acknowledgeScheduledMeetings(this.upcomingMeetings());
        }
      });

    if (this.isMeetingListUrl(this.router.url)) {
      this.acknowledgeScheduledMeetings(this.upcomingMeetings());
    }
  }

  private updateScheduledMeetingNotifications(upcoming: MeetingResponse[]): void {
    this.upcomingMeetings.set(upcoming);

    if (this.isMeetingListUrl()) {
      this.acknowledgeScheduledMeetings(upcoming);
      return;
    }

    const unreadScheduledMeetings = upcoming.filter(
      meeting => !this.seenScheduledMeetingIds.has(meeting.id)
    );

    this.scheduledMeetingNotificationCount.set(unreadScheduledMeetings.length);
  }

  private acknowledgeScheduledMeetings(meetings: MeetingResponse[]): void {
    meetings.forEach(meeting => this.seenScheduledMeetingIds.add(meeting.id));
    this.persistSeenScheduledMeetingIds();
    this.scheduledMeetingNotificationCount.set(0);
  }

  private isMeetingListUrl(url = this.currentUrl()): boolean {
    return url.startsWith('/dashboard/meeting');
  }

  private readSeenScheduledMeetingIds(): Set<number> {
    try {
      const raw = localStorage.getItem(MainLayoutsComponent.SEEN_SCHEDULED_MEETINGS_KEY);
      const parsed = raw ? JSON.parse(raw) : [];

      return new Set(
        Array.isArray(parsed)
          ? parsed.map(Number).filter(Number.isFinite)
          : []
      );
    } catch {
      return new Set<number>();
    }
  }

  private persistSeenScheduledMeetingIds(): void {
    try {
      localStorage.setItem(
        MainLayoutsComponent.SEEN_SCHEDULED_MEETINGS_KEY,
        JSON.stringify(Array.from(this.seenScheduledMeetingIds))
      );
    } catch {
      // If browser storage is unavailable, keep the in-memory state for this session.
    }
  }

  private startChatRealtimeConnection(): void {
    const token = this.tokenService.getAccessToken();

    if (token) {
      this.chatWsService.connect(token);
    }
  }
}
