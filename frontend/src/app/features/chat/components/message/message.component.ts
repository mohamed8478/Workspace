import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  effect,
  inject,
  signal,
  ViewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChatService } from '../../services/chat.service';
import { Message } from '../../models/message.model';
import { TokenService } from '../../../../core/services/token.service';
import { UserSearchResult } from '../../../../shared/models/user-search.model';

@Component({
  selector: 'app-message',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './message.component.html',
  styleUrl: './message.component.css'
  // styleUrl : '../../../../shared/style/chat.css'
})
export class MessageComponent {

  private readonly chatService = inject(ChatService);
  private readonly tokenService = inject(TokenService);

  readonly selectedChat = this.chatService.selectedChat;
  readonly selectedContact = this.chatService.selectedContact;
  readonly messages = this.chatService.messages;
  readonly loadingMessages = this.chatService.loadingMessages;
  readonly sendingMessage = this.chatService.sendingMessage;

  readonly draftMessage = signal('');

  readonly chats = this.chatService.chats;

  // @ViewChild('messagesContainer')
  // private messagesContainer!: ElementRef;
  // ngAfterViewInit(): void {
  //   this.scrollToBottom();
  // }

  // private scrollToBottom(): void {
  //   const element = this.messagesContainer.nativeElement;

  //   element.scrollTop = element.scrollHeight;
  // }

  readonly currentUserId = signal<number | null>(
    this.resolveCurrentUserId()
  );


@ViewChild('messagesContainer')
private container!: ElementRef;

constructor() {
  effect(() => {
    this.messages();      // subscribe to signal
    this.selectedChat();  // subscribe to signal
    setTimeout(() => this.scrollToBottom(), 0);
  });
}

ngAfterViewInit(): void {
  this.scrollToBottom();
}

private scrollToBottom(): void {
  const el = this.container?.nativeElement;
  if (!el) return;
  el.scrollTop = el.scrollHeight;
}

  

  readonly headerTitle = computed(() => {
    const chat = this.selectedChat();
    if (chat) {
      return chat.name;
    }

    const contact = this.selectedContact();
    if (contact) {
      return this.chatService.getContactDisplayName(contact);
    }

    return 'Select a chat';
  });

  onDraftChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.draftMessage.set(target.value);
  }

  sendMessage(): void {
    const content = this.draftMessage().trim();
    if (!content) {
      return;
    }

    this.chatService.sendMessage(content);
    this.draftMessage.set('');
  }

  selectSuggestion(text: string): void {
    this.draftMessage.set(text);
  }

  isOwnMessage(message: Message): boolean {
    const currentUserId = this.currentUserId();
    return currentUserId !== null && message.senderId === currentUserId;
  }

  formatMessageTime(value: string): string {
    if (!value) {
      return '';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '';
    }

    return date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  getAvatarUrl(chatId?: number): string {
    if (!chatId) {
      return 'https://i.pravatar.cc/40?u=empty';
    }

    return `https://i.pravatar.cc/40?u=${chatId}`;
  }

  getContactDisplayName(contact: UserSearchResult): string {
    return this.chatService.getContactDisplayName(contact);
  }

  private resolveCurrentUserId(): number | null {
    const payload = this.tokenService.decodePayload();
  
    const parsed = Number(payload?.userId ?? payload?.sub);
    
    return Number.isFinite(parsed) ? parsed : null;
  }
  

}
