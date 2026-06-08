import {
    ChangeDetectionStrategy,
    Component,
    DestroyRef,
    computed,
    inject,
    OnInit,
    signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { Router } from '@angular/router';
import { MeetingService } from '../../services/meeting.service';
import {
    MeetingActiveParticipantsResponse,
    MeetingApiService,
    MeetingResponse,
} from '../../services/meeting.api.service';
import { catchError, forkJoin, interval, of, startWith, switchMap } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LivekitRoomService } from '../../../livekit/services/livekit-room.service';
import { environment } from '../../../../../environments/environment';
import { NotificationService } from '../../../../core/services/notification.service';

@Component({
    selector: 'app-meeting-page',
    imports: [RouterLink],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './meeting-page.component.html',
    styleUrl: './meeting-page.component.css'
})
export class MeetingPageComponent implements OnInit {
    private readonly meetingApiService = inject(MeetingApiService);
    private readonly meetingService = inject(MeetingService);
    private readonly roomService = inject(LivekitRoomService);
    private readonly router = inject(Router);
    private readonly destroyRef = inject(DestroyRef);
    private readonly notificationService = inject(NotificationService);

    readonly meetings = this.meetingService.meetings;
    readonly activeMeetings = signal<MeetingResponse[]>([]);
    readonly upcomingMeetings = signal<MeetingResponse[]>([]);
    readonly activeParticipantsByMeeting = signal<Record<number, MeetingActiveParticipantsResponse>>({});
    readonly activeMeetingsCount = computed(() => this.activeMeetings().length);


    formatDate(dateStr: string): { dayLabel: string; monthLabel: string } {
        const date = new Date(dateStr);

        const day = date.getDate().toString();
        const month = date.toLocaleString('en-US', { month: 'short' }).toUpperCase();

        return { dayLabel: day, monthLabel: month };
    }




    formatTime(dateStr: string): string {
        return new Date(dateStr).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
    }

    getFirstLetter(name: string): string {
        return name.charAt(0).toUpperCase();
    }



    getMinutesUntilMeeting(meeting: MeetingResponse): number {
        const meetingTime = new Date(meeting.startTime).getTime();
        const now = Date.now();

        const diffMs = now - meetingTime;

        return Math.max(0, Math.floor(diffMs / (1000 * 60)));
    }

    activeCountFor(meetingId: number): number {
        return this.visibleActiveParticipantsFor(meetingId).length;
    }

    activeNamesFor(meetingId: number): string[] {
        return this.visibleActiveParticipantsFor(meetingId)
            .map((participant) => participant.name?.trim() || participant.identity?.trim())
            .filter((name): name is string => Boolean(name));
    }

    getInitials(name: string): string {
        const words = name.split(' ').filter(Boolean);
        if (words.length === 0) {
            return '';
        }
        if (words.length === 1) {
            return words[0][0]?.toUpperCase() ?? '';
        }
        return `${words[0][0] ?? ''}${words[1][0] ?? ''}`.toUpperCase();
    }

    joinMeeting(meeting: MeetingResponse): void {
        this.meetingApiService
            .getToken(meeting.id)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: async (response) => {
                    await this.roomService.connect(environment.livekitUrl, response.token, response.roomName, response.meetingId);
                    void this.router.navigate(['/livekit/room']);
                },
                error: (error) => {
                    console.error('Failed to join meeting', error);
                },
            });
    }

    copyMeetingLink(meeting: MeetingResponse): void {
        const meetingLink = this.getMeetingLink(meeting.id);

        if (navigator.clipboard?.writeText) {
            navigator.clipboard
                .writeText(meetingLink)
                .then(() => this.notificationService.success('Meeting link copied'))
                .catch(() => this.copyMeetingLinkFallback(meetingLink));
            return;
        }

        this.copyMeetingLinkFallback(meetingLink);
    }

    ngOnInit(): void {
        interval(20_000)
            .pipe(
                startWith(0),
                switchMap(() => this.meetingApiService.getMeetings()),
                takeUntilDestroyed(this.destroyRef)
            )
            .subscribe({
                next: (data) => {
                    this.meetingService.meetings.set(data);
                },
                error: (err) => {
                    console.error(err);
                },
            });

        interval(10_000)
            .pipe(
                startWith(0),
                switchMap(() => this.meetingApiService.getActiveMeetings()),
                takeUntilDestroyed(this.destroyRef)
            )
            .subscribe((meetings) => {
                this.activeMeetings.set(meetings);
                this.refreshActiveParticipants(meetings);
            });

        interval(20_000)
            .pipe(
                startWith(0),
                switchMap(() => this.meetingApiService.getUpcomingMeetings()),
                takeUntilDestroyed(this.destroyRef)
            )
            .subscribe((meetings) => {
                this.upcomingMeetings.set(meetings);
            });
    }

    private refreshActiveParticipants(meetings: MeetingResponse[]): void {
        if (meetings.length === 0) {
            this.activeParticipantsByMeeting.set({});
            return;
        }

        const requests = meetings.map((meeting) =>
            this.meetingApiService.getActiveParticipants(meeting.id).pipe(
                catchError(() =>
                    of({
                        meetingId: meeting.id,
                        roomName: meeting.livekitRoomName ?? '',
                        activeCount: 0,
                        participants: [],
                    })
                )
            )
        );

        forkJoin(requests)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe((responses) => {
                const nextMap = responses.reduce<Record<number, MeetingActiveParticipantsResponse>>(
                    (acc, response) => {
                        acc[response.meetingId] = response;
                        return acc;
                    },
                    {}
                );
                this.activeParticipantsByMeeting.set(nextMap);
            });
    }

    private getMeetingLink(meetingId: number): string {
        const path = this.router.serializeUrl(
            this.router.createUrlTree(['/meeting', meetingId])
        );

        return `${window.location.origin}${path}`;
    }

    private copyMeetingLinkFallback(meetingLink: string): void {
        const textarea = document.createElement('textarea');
        textarea.value = meetingLink;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();

        const copied = document.execCommand('copy');
        document.body.removeChild(textarea);

        if (copied) {
            this.notificationService.success('Meeting link copied');
            return;
        }

        this.notificationService.error('Could not copy meeting link');
    }

    private isAgentParticipantName(name: string): boolean {
        const normalized = name.trim().toLowerCase();

        return normalized === 'agent'
            || normalized === 'stt-agent'
            || normalized === 'ai-agent'
            || normalized === 'meeting-agent'
            || normalized === 'transcript-agent'
            || normalized === 'backend-dispatcher'
            || normalized.startsWith('agent-')
            || normalized.startsWith('agent_')
            || normalized.startsWith('stt-agent-');
    }

    private visibleActiveParticipantsFor(meetingId: number): MeetingActiveParticipantsResponse['participants'] {
        const participants = this.activeParticipantsByMeeting()[meetingId]?.participants ?? [];

        return participants.filter((participant) => {
            const displayName = participant.name?.trim();
            const identity = participant.identity?.trim();

            return !(
                (displayName && this.isAgentParticipantName(displayName)) ||
                (identity && this.isAgentParticipantName(identity))
            );
        });
    }
}
