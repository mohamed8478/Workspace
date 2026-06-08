import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChatService } from '../../services/chat.service';
import { Chat } from '../../models/chat.model';
import { UserSearchResult } from '../../../../shared/models/user-search.model';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './chat.component.html',
  styleUrl: './chat.component.css'
  // styleUrl : '../../../../shared/style/chat.css'

})
export class ChatComponent {

  private readonly chatService = inject(ChatService);

  readonly searchTerm = signal('');

  readonly groupChats = signal<Chat[]>([
    {
      id: 9001,
      name: 'Engineering',
      type: 'GROUP',
      lastMessage: 'Sprint planning notes',
      lastMessageDate: '2024-10-12T09:30:00Z',
      unreadCount: 12
    },
    {
      id: 9002,
      name: 'Marketing',
      type: 'GROUP',
      lastMessage: 'Campaign assets updated',
      lastMessageDate: '2024-10-11T16:05:00Z',
      unreadCount: 4
    },
    {
      id: 9003,
      name: 'Sales',
      type: 'GROUP',
      lastMessage: 'Pipeline review deck',
      lastMessageDate: '2024-10-10T14:15:00Z',
      unreadCount: 0
    }
  ]);

  readonly selectedChatId = this.chatService.selectedChatId;

  readonly selectedContact = this.chatService.selectedContact;

  readonly contactResults = this.chatService.contactResults;

  readonly loadingContacts = this.chatService.loadingContacts;

  readonly loadingChats = this.chatService.loadingChats;

  readonly chats = this.chatService.chats;

  

  readonly directChats = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();

    const chats = this.chatService
      .chats()
      .filter(chat => chat.type !== 'GROUP');

    if (!term) {
      return chats;
    }

    return chats.filter(chat => {
      const name = chat.name.toLowerCase();
      const preview = (chat.lastMessage ?? '').toLowerCase();
      return name.includes(term) || preview.includes(term);
    });
  });

  readonly showContacts = computed(() => {
    const term = this.searchTerm().trim();

    return term.length > 0 && this.directChats().length === 0;
  });

  onSearchChange(event: Event): void {
    const target = event.target as HTMLInputElement;
  const value = target.value;
  this.searchTerm.set(value);

  if (this.directChats().length === 0) {
    this.chatService.searchContacts(value);
  }
    
  }

  selectChat(chat: Chat): void {
    this.chatService.selectChat(chat.id);
  }

  selectContact(contact: UserSearchResult): void {
    this.chatService.selectContact(contact);
  }

  getAvatarUrl(chatId: number): string {
    return `https://i.pravatar.cc/36?u=${chatId}`;
  }

  getPreviewText(chat: Chat): string {
    return chat.lastMessage?.trim()
      ? chat.lastMessage
      : 'No messages yet';
  }

  getContactDisplayName(contact: UserSearchResult): string {
    return this.chatService.getContactDisplayName(contact);
  }

  formatPreviewTime(value?: string): string {
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

}
