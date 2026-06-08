/**
 * Users API Service
 * Provides search endpoints for chat contacts
 */

import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';
import { UserSearchResult } from '../shared/models/user-search.model';

@Injectable({
  providedIn: 'root'
})
export class UsersApiService {
  private readonly http = inject(HttpClient);
  private readonly api = `${environment.apiUrl}`;

  searchUsers(query: string): Observable<UserSearchResult[]> {
    const params = new HttpParams().set('q', query);

    return this.http.get<UserSearchResult[]>(
      `${this.api}/users`,
      { params }
    );
  }

}
