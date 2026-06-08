export interface TokenRequest {
  roomName: string;
  participantName: string;
}

export interface TokenResponse {
  token: string;
}

export interface ParticipantTrack {
  participantSid: string;
  participantName: string;
  trackSid: string;
  element?: HTMLVideoElement | HTMLAudioElement;
}

export interface RoomState {
  connected: boolean;
  connecting: boolean;
  error: string | null;
  roomName: string;
  participantName: string;
  participantCount: number;
}