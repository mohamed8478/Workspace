/**
 * Video Tile Component
 * Displays a single participant's video stream
 */
import {
  Component,
  Input,
  ViewChild,
  ElementRef,
  AfterViewInit,
  OnChanges,
  OnDestroy,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Participant, ParticipantEvent, Track } from 'livekit-client';

@Component({
  selector: 'app-video-tile',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './video-tile.component.html',
  styleUrl: './video-tile.component.css',
})
export class VideoTileComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input({ required: true }) participant!: Participant;
  @Input() isLocal = false;

  private readonly cdr = inject(ChangeDetectorRef);
  private registeredParticipant: Participant | null = null;

  @ViewChild('videoEl') videoEl!: ElementRef<HTMLVideoElement>;

  cameraEnabled = true;
  isSpeaking = false;

  ngAfterViewInit(): void {
    this.registerParticipantEvents();
    this.attachVideo();
  }

  ngOnChanges(): void {
    this.registerParticipantEvents();
    this.attachVideo();
  }

  ngOnDestroy(): void {
    this.unregisterParticipantEvents();
    this.detachVideo();
  }

  private attachVideo(): void {
    if (!this.videoEl || !this.participant) return;

    const el = this.videoEl.nativeElement;
    const camPub = this.participant.getTrackPublication(Track.Source.Camera);
    const hasCameraTrack = Boolean(camPub?.track) && !(camPub as any)?.isMuted;

    if (hasCameraTrack && camPub?.track) {
      camPub.track.attach(el);
      this.cameraEnabled = true;
    } else {
      this.detachVideo();
      this.cameraEnabled = false;
    }

    this.isSpeaking = this.participant.isSpeaking;
    this.cdr.markForCheck();
  }

  private detachVideo(): void {
    const el = this.videoEl?.nativeElement;
    if (!el) {
      return;
    }

    const camPub = this.participant?.getTrackPublication(Track.Source.Camera);
    camPub?.track?.detach(el);
    el.srcObject = null;
  }

  private registerParticipantEvents(): void {
    if (!this.participant || this.registeredParticipant === this.participant) {
      return;
    }

    this.unregisterParticipantEvents();
    this.registeredParticipant = this.participant;

    this.participant
      .on(ParticipantEvent.TrackSubscribed, this.refreshTile)
      .on(ParticipantEvent.TrackUnsubscribed, this.refreshTile)
      .on(ParticipantEvent.TrackMuted, this.refreshTile)
      .on(ParticipantEvent.TrackUnmuted, this.refreshTile)
      .on(ParticipantEvent.LocalTrackPublished, this.refreshTile)
      .on(ParticipantEvent.LocalTrackUnpublished, this.refreshTile)
      .on(ParticipantEvent.IsSpeakingChanged, this.refreshTile);
  }

  private unregisterParticipantEvents(): void {
    if (!this.registeredParticipant) {
      return;
    }

    this.registeredParticipant
      .off(ParticipantEvent.TrackSubscribed, this.refreshTile)
      .off(ParticipantEvent.TrackUnsubscribed, this.refreshTile)
      .off(ParticipantEvent.TrackMuted, this.refreshTile)
      .off(ParticipantEvent.TrackUnmuted, this.refreshTile)
      .off(ParticipantEvent.LocalTrackPublished, this.refreshTile)
      .off(ParticipantEvent.LocalTrackUnpublished, this.refreshTile)
      .off(ParticipantEvent.IsSpeakingChanged, this.refreshTile);

    this.registeredParticipant = null;
  }

  private readonly refreshTile = () => {
    queueMicrotask(() => this.attachVideo());
  };

  /**
   * Get initials from participant name
   */
  getInitials(): string {
    const name = this.participant.name || this.participant.identity;
    return (name?.[0] ?? '?').toUpperCase();
  }
}
