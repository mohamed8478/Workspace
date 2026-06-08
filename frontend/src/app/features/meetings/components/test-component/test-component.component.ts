import { Component, OnDestroy, signal, ChangeDetectionStrategy } from '@angular/core';

import { environment } from '../../../../../environments/environment';

@Component({
  selector: 'app-test-component',
  standalone: true,
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './test-component.component.html',
  styleUrl: './test-component.component.css',
})
export class TestComponentComponent implements OnDestroy {
  private mediaRecorder?: MediaRecorder;
  private stream?: MediaStream;
  private socket?: WebSocket;

  isConnecting = signal(false);
  isRecording = signal(false);
  lastError = signal('');
  transcript = signal('');

  async startRecording() {
    this.lastError.set('');
    this.transcript.set('');
    this.isConnecting.set(true);

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const params = new URLSearchParams({
        model: 'nova-2',
        language: 'fr',
        smart_format: 'true',
        interim_results: 'true',
        endpointing: '300',
        token: environment.deepgramApiKey,
      });

      this.socket = new WebSocket(`wss://api.deepgram.com/v1/listen?${params.toString()}`);

      this.socket.onopen = () => {
        this.isConnecting.set(false);
        this.isRecording.set(true);
        this.startMediaRecorder();
      };

      this.socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        const alt = data.channel?.alternatives?.[0];
        if (alt?.transcript && alt.transcript.trim().length > 0) {
          if (data.is_final) {
            console.log('Final:', alt.transcript);
            this.transcript.update((t) => t + alt.transcript + ' ');
          } else {
            console.log('Interim:', alt.transcript);
          }
        }
      };

      this.socket.onerror = () => {
        this.lastError.set('WebSocket error. Check your API key and network.');
        this.isConnecting.set(false);
        this.isRecording.set(false);
        this.cleanup();
      };

      this.socket.onclose = (event) => {
        if (event.code === 1006) {
          this.lastError.set('Connection rejected (1006). API key invalid or Deepgram unreachable.');
        }
        this.isRecording.set(false);
        this.isConnecting.set(false);
      };
    } catch (err) {
      this.isConnecting.set(false);
      this.lastError.set(err instanceof Error ? err.message : 'Unknown error');
      this.cleanup();
    }
  }

  private startMediaRecorder() {
    const options: MediaRecorderOptions = {};
    if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
      options.mimeType = 'audio/webm;codecs=opus';
    } else if (MediaRecorder.isTypeSupported('audio/webm')) {
      options.mimeType = 'audio/webm';
    } else if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
      options.mimeType = 'audio/ogg;codecs=opus';
    }

    this.mediaRecorder = new MediaRecorder(this.stream!, options);

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0 && this.socket?.readyState === WebSocket.OPEN) {
        this.socket.send(event.data);
      }
    };

    this.mediaRecorder.onstop = () => {
      if (this.socket?.readyState === WebSocket.OPEN) {
        this.socket.send(new Uint8Array(0));
      }
    };

    this.mediaRecorder.start(250);
  }

  stopRecording() {
    try {
      this.mediaRecorder?.stop();
      this.socket?.close(1000, 'Client stopped recording');
    } catch {
      // ignore
    }
    this.cleanup();
    this.isRecording.set(false);
    this.isConnecting.set(false);
  }

  private cleanup() {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = undefined;
    this.mediaRecorder = undefined;
    this.socket = undefined;
  }

  ngOnDestroy(): void {
    this.stopRecording();
  }
}
