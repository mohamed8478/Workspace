/**
 * LiveKit Room Service
 * Manages room state, participant list, and connection lifecycle
 * Uses signals for reactive state updates
 */
import { Injectable, signal, computed } from '@angular/core';
import {
  Room,
  RoomEvent,
  RemoteParticipant,
  LocalParticipant,
  VideoPresets,
  TrackPublication,
} from 'livekit-client';

interface StoredMeetingSession {
  readonly meetingId: number;
  readonly roomName: string;
}

@Injectable({ providedIn: 'root' })
export class LivekitRoomService {
  private static readonly MEETING_SESSION_KEY = 'workspace.activeLivekitMeeting';
  private room: Room | null = null;

  // Reactive signals for UI updates
  readonly connected = signal(false);
  readonly connecting = signal(false);
  readonly error = signal<string | null>(null);
  readonly participants = signal<RemoteParticipant[]>([]);
  readonly localParticipant = signal<LocalParticipant | null>(null);
  readonly roomName = signal('');

  // Computed values
  readonly participantCount = computed(
    () => this.participants().length + (this.localParticipant() ? 1 : 0)
  );

  /**
   * Connect to LiveKit room
   * @param livekitUrl - WebSocket URL of LiveKit server
   * @param token - JWT token from backend
   * @param roomName - Name of the room to join
   */
  async connect(
    livekitUrl: string,
    token: string,
    roomName: string,
    meetingId?: number
  ): Promise<void> {
    this.connecting.set(true);
    this.error.set(null);
    this.roomName.set(roomName);

    try {
      this.room = new Room({
        adaptiveStream: true,
        dynacast: true,
        videoCaptureDefaults: {
          resolution: VideoPresets.h720.resolution,
        },
      });

      this.registerRoomEvents();

      this.room.prepareConnection(livekitUrl, token);
      await this.room.connect(livekitUrl, token);
      await this.room.localParticipant.enableCameraAndMicrophone();

      this.localParticipant.set(this.room.localParticipant);
      this.connected.set(true);

      if (meetingId) {
        this.storeMeetingSession({ meetingId, roomName });
      }
    } catch (err: any) {
      const message = err?.message ?? 'Connection failed';
      this.error.set(message);
      throw new Error(message);
    } finally {
      this.connecting.set(false);
    }
  }

  /**
   * Disconnect from room and clean up resources
   */
  async disconnect(): Promise<void> {
    this.clearStoredMeetingSession();
    if (this.room) {
      await this.room.disconnect();
    }
    this.reset();
  }

  /**
   * Toggle camera on/off
   */
  async toggleCamera(): Promise<void> {
    if (!this.room) return;
    const enabled = this.room.localParticipant.isCameraEnabled;
    await this.room.localParticipant.setCameraEnabled(!enabled);
  }

  /**
   * Toggle microphone on/off
   */
  async toggleMicrophone(): Promise<void> {
    if (!this.room) return;
    const enabled = this.room.localParticipant.isMicrophoneEnabled;
    await this.room.localParticipant.setMicrophoneEnabled(!enabled);
  }

  /**
   * Toggle screen sharing on/off
   */
  async toggleScreenShare(): Promise<void> {
    if (!this.room) return;
    const enabled = this.room.localParticipant.isScreenShareEnabled;
    await this.room.localParticipant.setScreenShareEnabled(!enabled);
  }

  /**
   * Get current camera enabled state
   */
  isCameraEnabled(): boolean {
    return this.room?.localParticipant.isCameraEnabled ?? false;
  }

  /**
   * Get current microphone enabled state
   */
  isMicrophoneEnabled(): boolean {
    return this.room?.localParticipant.isMicrophoneEnabled ?? false;
  }

  /**
   * Get current screen sharing state
   */
  isScreenShareEnabled(): boolean {
    return this.room?.localParticipant.isScreenShareEnabled ?? false;
  }

  /**
   * Attach track to HTML element (video/audio)
   */
  attachTrackToElement(
    publication: TrackPublication,
    element: HTMLVideoElement | HTMLAudioElement
  ): void {
    publication.track?.attach(element);
  }

  /**
   * Detach track from all elements
   */
  detachTrack(publication: TrackPublication): void {
    publication.track?.detach();
  }

  getStoredMeetingSession(): StoredMeetingSession | null {
    try {
      const raw = sessionStorage.getItem(LivekitRoomService.MEETING_SESSION_KEY);
      const parsed = raw ? JSON.parse(raw) as StoredMeetingSession : null;

      if (!parsed?.meetingId || !parsed.roomName) {
        return null;
      }

      return parsed;
    } catch {
      return null;
    }
  }

  clearStoredMeetingSession(): void {
    sessionStorage.removeItem(LivekitRoomService.MEETING_SESSION_KEY);
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  private registerRoomEvents(): void {
    if (!this.room) return;

    this.room
      .on(RoomEvent.ParticipantConnected, () => this.syncParticipants())
      .on(RoomEvent.ParticipantDisconnected, () => this.syncParticipants())
      .on(RoomEvent.TrackSubscribed, () => this.syncParticipants())
      .on(RoomEvent.TrackUnsubscribed, () => this.syncParticipants())
      .on(RoomEvent.Disconnected, () => this.reset())
      .on(RoomEvent.Reconnecting, () => this.connecting.set(true))
      .on(RoomEvent.Reconnected, () => this.connecting.set(false));
  }

  private syncParticipants(): void {
    if (!this.room) return;
    this.participants.set(
      Array.from(this.room.remoteParticipants.values())
        .filter(participant => !this.isHiddenAgentParticipant(participant))
    );
  }

  private isHiddenAgentParticipant(participant: RemoteParticipant): boolean {
    if (participant.isAgent) {
      return true;
    }

    const identity = this.normalizeParticipantMarker(participant.identity);
    const name = this.normalizeParticipantMarker(participant.name);
    const metadata = this.normalizeParticipantMarker(participant.metadata);
    const role = this.normalizeParticipantMarker(participant.attributes?.['role']);
    const hidden = this.normalizeParticipantMarker(participant.attributes?.['hidden']);
    const workspaceRole = this.normalizeParticipantMarker(participant.attributes?.['workspace-role']);

    return this.isReservedAgentName(identity)
      || this.isReservedAgentName(name)
      || role === 'agent'
      || workspaceRole === 'workspace-hidden-agent'
      || hidden === 'true'
      || metadata.includes('"role":"agent"')
      || metadata.includes('"hidden":true')
      || metadata.includes('workspace-hidden-agent');
  }

  private isReservedAgentName(value: string): boolean {
    return value === 'stt'
      || value === 'stt-agent'
      || value === 'meeting-agent'
      || value === 'transcript-agent'
      || value === 'backend-dispatcher'
      || value.startsWith('stt-agent-')
      || value.startsWith('meeting-agent-')
      || value.startsWith('transcript-agent-');
  }

  private normalizeParticipantMarker(value: string | undefined): string {
    return value?.trim().toLowerCase() ?? '';
  }

  private storeMeetingSession(session: StoredMeetingSession): void {
    sessionStorage.setItem(
      LivekitRoomService.MEETING_SESSION_KEY,
      JSON.stringify(session)
    );
  }

  private reset(): void {
    this.connected.set(false);
    this.connecting.set(false);
    this.participants.set([]);
    this.localParticipant.set(null);
    this.roomName.set('');
    this.room = null;
  }
}
