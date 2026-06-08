/**
 * LiveKit API Service
 * Handles HTTP calls to backend LiveKit endpoints
 * No business logic - raw HTTP calls only
 */
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { TokenRequest, TokenResponse } from '../shared/models/livekit.model';

@Injectable({ providedIn: 'root' })
export class LivekitApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/livekit`;

  /**
   * Request a LiveKit access token from the backend
   * @param request - Room name and participant name
   * @returns Observable of token response
   */
  getToken(request: TokenRequest): Observable<TokenResponse> {
    return this.http.post<TokenResponse>(`${this.baseUrl}/token`, request);
  }
}
