import { Injectable, inject } from '@angular/core';
import { environment } from '../../../../environments/environment';
import { TokenService } from '../../../core/services/token.service';

export interface MeetingAiChatRequest {
  readonly question: string;
  readonly roomName: string;
}

@Injectable({ providedIn: 'root' })
export class MeetingAiChatService {
  private readonly tokenService = inject(TokenService);
  private readonly endpoint = `${environment.apiUrl}/ai/meeting-question-stream`;

  async ask(
    request: MeetingAiChatRequest,
    onChunk: (chunk: string) => void,
    signal?: AbortSignal
  ): Promise<void> {
    const token = this.tokenService.getAccessToken();
    const url = new URL(this.endpoint);
    url.searchParams.set('roomName', request.roomName);
    url.searchParams.set('question', request.question);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Accept: 'text/event-stream',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      signal,
    });

    if (!response.ok) {
      throw new Error(`AI request failed with status ${response.status}`);
    }

    if (!response.body) {
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let pending = '';

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      pending += decoder.decode(value, { stream: true });
      const lines = pending.split(/\r?\n/);
      pending = lines.pop() ?? '';
      await this.emitChunks(
        lines.flatMap((line) => this.parseStreamLine(line)),
        onChunk
      );
    }

    pending += decoder.decode();
    await this.emitChunks(this.parseStreamLine(pending), onChunk);
  }

  private async emitChunks(
    chunks: string[],
    onChunk: (chunk: string) => void
  ): Promise<void> {
    for (const chunk of chunks) {
      onChunk(chunk);
      await new Promise<void>((resolve) => setTimeout(resolve, 12));
    }
  }

  private parseStreamLine(line: string): string[] {
    if (!line || line.startsWith(':')) {
      return [];
    }

    const rawValue = line.startsWith('data:')
      ? line.slice(5)
      : line;
    const value = rawValue.startsWith(' ') ? rawValue.slice(1) : rawValue;

    return value === '[DONE]' ? [] : [value];
  }
}
