import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';

import { Message } from '../models/message.model';
import { Chat } from '../models/chat.model';
import { MessageRequest } from '../models/message-request.model';

@Injectable({
  providedIn: 'root'
})
export class ChatApiService {

    private readonly http = inject(HttpClient);

    private readonly api =`${environment.apiUrl}/v1`;

getUserChats(): Observable<Chat[]> {

    return this.http.get<Chat[]>(
      `${this.api}/chat`
    );
  }

  getChatMessages(chatId: number): Observable<Message[]> {

    return this.http.get<Message[]>(
      `${this.api}/message/chat/${chatId}`
    );
  }

  sendMessage(request: MessageRequest): Observable<Message | null> {

    return this.http.post<Message | null>(
      `${this.api}/message/add`,
      request
    );
  }

  sendMediaMessage(
      request: MessageRequest,
      file: File
  ): Observable<Message | null> {

    const formData = new FormData();

    formData.append(
      'message',
      new Blob(
        [JSON.stringify(request)],
        { type: 'application/json' }
      )
    );

    formData.append('file', file);

    return this.http.post<Message | null>(
      `${this.api}/message/add-media`,
      formData
    );
  }
}
