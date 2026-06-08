import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { Meeting } from '../models/meeting.model';

export interface MeetingRequest {
    title: string;
    startTime: string; // ISO string "2025-05-24T09:00:00"
    description: string;
    participantsId: number[];
}


// src/app/models/meeting.model.ts

export type MeetingStatus = 'SCHEDULED' | 'ACTIVE' | 'ENDED';

export interface MeetingParticipant {
    id: number;
    name: string;
}

export interface MeetingResponse {
    id: number;
    title: string;
    startTime: string;        // LocalDateTime comes as ISO string from Spring
    description: string;
    status: MeetingStatus;
    livekitRoomName: string | null;
    participants: MeetingParticipant[];
}

export interface ActiveParticipantResponse {
    identity: string;
    name: string;
}

export interface MeetingActiveParticipantsResponse {
    meetingId: number;
    roomName: string;
    activeCount: number;
    participants: ActiveParticipantResponse[];
}

export interface TokenResponse {
    token: string;
    roomName: string;
    meetingId: number;
}

export interface CreateMeetingRequest {
    title: string;
    startTime: string;        // send as ISO string: "2026-05-30T14:00:00"
    description: string;
    participantsId: number[];
}


@Injectable({
    providedIn: 'root'
})
export class MeetingApiService {
    private readonly http = inject(HttpClient);
    private readonly api = `${environment.apiUrl}/meeting`;

    create(request: MeetingRequest): Observable<void> {
        return this.http.post<void>(this.api, request);
    }

    getMeetings(): Observable<Meeting[]> {
        return this.http.get<Meeting[]>(this.api);
    }
    
    getActiveMeetings(): Observable<MeetingResponse[]> {
        return this.http.get<MeetingResponse[]>(`${this.api}/active`);
    }

    getUpcomingMeetings(): Observable<MeetingResponse[]> {
        return this.http.get<MeetingResponse[]>(`${this.api}/upcoming`);
    }

    getToken(meetingId: number): Observable<TokenResponse> {
        return this.http.get<TokenResponse>(`${this.api}/${meetingId}/token`);
    }

    getActiveParticipants(meetingId: number): Observable<MeetingActiveParticipantsResponse> {
        return this.http.get<MeetingActiveParticipantsResponse>(`${this.api}/${meetingId}/active-participants`);
    }

    createMeeting(data: CreateMeetingRequest): Observable<MeetingResponse> {
        return this.http.post<MeetingResponse>(this.api, data);
    }





}

