/**
 * Room Component (Main Meeting View)
 * Displays video grid and control bar
 */
import {
  Component,
  inject,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  DestroyRef,
  ElementRef,
  NgZone,
  OnInit,
  ViewChild,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { VideoTileComponent } from '../video-tile/video-tile.component';
import { LivekitRoomService } from '../services/livekit-room.service';
import { Router } from '@angular/router';
import { MeetingAiChatService } from '../services/meeting-ai-chat.service';
import { MeetingApiService } from '../../meetings/services/meeting.api.service';
import { environment } from '../../../../environments/environment';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

interface AiChatMessage {
  readonly id: number;
  readonly role: 'user' | 'assistant';
  readonly content: string;
}

@Component({
  selector: 'app-livekit-room',
  standalone: true,
  imports: [CommonModule, VideoTileComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './room.component.html',
  styleUrl: './room.component.css',
})
export class RoomComponent implements OnInit {
  readonly roomService = inject(LivekitRoomService);
  private readonly router = inject(Router);
  private readonly aiChatService = inject(MeetingAiChatService);
  private readonly meetingApiService = inject(MeetingApiService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly ngZone = inject(NgZone);
  private activeRequest: AbortController | null = null;

  @ViewChild('aiMessages') private aiMessages?: ElementRef<HTMLDivElement>;

  readonly aiMessagesList = signal<AiChatMessage[]>([
    {
        id: 1,
        role: 'assistant',
        content:
          'Hi, I am your meeting co-pilot. I can summarize this room, catch decisions, and turn the conversation into action items.',
      },
  ]);
  readonly aiQuestion = signal('');
  readonly aiStreaming = signal(false);
  readonly aiError = signal<string | null>(null);
  readonly aiSuggestions = [
    'Summarize meeting',
    'Action items',
    'Decision log',
    'Speaker stats',
  ];

  constructor() {
    this.destroyRef.onDestroy(() => this.activeRequest?.abort());
  }

  ngOnInit(): void {
    this.reconnectAfterRefresh();
  }

  /**
   * Check if microphone is enabled
   */
  get microphoneEnabled(): boolean {
    return this.roomService.isMicrophoneEnabled();
  }

  /**
   * Check if camera is enabled
   */
  get cameraEnabled(): boolean {
    return this.roomService.isCameraEnabled();
  }

  get screenShareEnabled(): boolean {
    return this.roomService.isScreenShareEnabled();
  }

  /**
   * Toggle microphone on/off
   */
  async toggleMicrophone(): Promise<void> {
    await this.roomService.toggleMicrophone();
  }

  /**
   * Toggle camera on/off
   */
  async toggleCamera(): Promise<void> {
    await this.roomService.toggleCamera();
  }

  async toggleScreenShare(): Promise<void> {
    await this.roomService.toggleScreenShare();
  }

  /**
   * Disconnect and leave room
   */
  async leaveRoom(): Promise<void> {
    this.activeRequest?.abort();
    await this.roomService.disconnect();
    this.router.navigate(['/dashboard/meeting']);

  }

  updateAiQuestion(value: string): void {
    this.aiQuestion.set(value);
  }

  useSuggestion(suggestion: string): void {
    this.aiQuestion.set(suggestion);
  }

  async askAi(): Promise<void> {
    const question = this.aiQuestion().trim();
    const roomName = this.roomService.roomName();

    if (!question || this.aiStreaming()) {
      return;
    }

    this.aiError.set(null);
    this.aiQuestion.set('');
    const createdAt = Date.now();
    const assistantMessageId = createdAt + 1;

    this.aiMessagesList.update((messages) => [
      ...messages,
      { id: createdAt, role: 'user', content: question },
      { id: assistantMessageId, role: 'assistant', content: '' },
    ]);
    this.scrollAiMessages();

    this.aiStreaming.set(true);
    this.activeRequest = new AbortController();

    try {
      await this.aiChatService.ask(
        { question, roomName },
        (chunk) => {
          this.ngZone.run(() => {
            this.appendAiChunk(assistantMessageId, chunk);
            this.scrollAiMessages();
            this.cdr.markForCheck();
          });
        },
        this.activeRequest.signal
      );
    } catch (error) {
      if (!this.activeRequest.signal.aborted) {
        this.aiError.set('The AI assistant could not answer right now. Please try again.');
      }
    } finally {
      this.aiStreaming.set(false);
      this.activeRequest = null;
      this.cdr.markForCheck();
    }
  }

  private scrollAiMessages(): void {
    setTimeout(() => {
      const element = this.aiMessages?.nativeElement;
      if (element) {
        element.scrollTop = element.scrollHeight;
      }
    });
  }

  private appendAiChunk(messageId: number, chunk: string): void {
    if (!chunk) {
      return;
    }

    this.aiMessagesList.update((messages) =>
      messages.map((message) =>
        message.id === messageId
          ? { ...message, content: this.joinAiChunk(message.content, chunk) }
          : message
      )
    );
  }

  private joinAiChunk(current: string, next: string): string {
    if (!current || /^\s|^[,.;:!?)]/.test(next)) {
      return `${current}${next}`;
    }

    if (/\s$|[(]$/.test(current)) {
      return `${current}${next}`;
    }

    return `${current} ${next}`;
  }

  private reconnectAfterRefresh(): void {
    if (this.roomService.connected() || this.roomService.connecting()) {
      return;
    }

    const session = this.roomService.getStoredMeetingSession();
    if (!session) {
      void this.router.navigate(['/dashboard/meeting']);
      return;
    }

    this.meetingApiService
      .getToken(session.meetingId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: async (response) => {
          try {
            await this.roomService.connect(
              environment.livekitUrl,
              response.token,
              response.roomName,
              response.meetingId
            );
            this.cdr.markForCheck();
          } catch {
            this.roomService.clearStoredMeetingSession();
            void this.router.navigate(['/dashboard/meeting']);
          }
        },
        error: () => {
          this.roomService.clearStoredMeetingSession();
          void this.router.navigate(['/dashboard/meeting']);
        },
      });
  }
}
