// features/chat/services/chat.service.ts

import {
  DestroyRef,
  Injectable,
  computed,
  inject,
  signal
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  Subject,
  catchError,
  debounceTime,
  distinctUntilChanged,
  map,
  of,
  switchMap
} from 'rxjs';

import { ChatApiService } from './chat-api.service';
import { UsersApiService } from '../../../api/users-api.service';

import { Chat } from '../models/chat.model';
import { Message } from '../models/message.model';
import { Notification } from '../models/notification.model';
import { MessageRequest } from '../models/message-request.model';
import { MessageType } from '../models/message-type.enum';
import { UserSearchResult } from '../../../shared/models/user-search.model';
import { TokenService } from '../../../core/services/token.service';

@Injectable({
    providedIn: 'root'
})
export class ChatService {

  private readonly chatApi =
      inject(ChatApiService);
  private readonly usersApi =
      inject(UsersApiService);
  private readonly tokenService = inject(TokenService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly searchQuery$ = new Subject<string>();
  private readonly chatsLoaded = signal(false);
  private readonly chatPageActive = signal(false);
  private tempMessageId = -1;

  /*
  |--------------------------------------------------------------------------
  | STATE
  |--------------------------------------------------------------------------
  */

  readonly chats = signal<Chat[]>([]);

  readonly messages = signal<Message[]>([]);

  readonly selectedChatId = signal<number | null>(null);

  readonly selectedContact = signal<UserSearchResult | null>(null);

  readonly contactResults = signal<UserSearchResult[]>([]);

  readonly loadingContacts = signal(false);

  private readonly pendingContactNames = signal<string[]>([]);

  readonly loadingChats = signal(false);

  readonly loadingMessages = signal(false);

  readonly sendingMessage = signal(false);

  readonly totalUnreadCount = signal(0);

  constructor() {
    this.searchQuery$
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((query) => {
          const trimmed = query.trim();

          if (!trimmed) {
            return of({ query: '', results: [] as UserSearchResult[] });
          }

          this.loadingContacts.set(true);

          return this.usersApi.searchUsers(trimmed).pipe(
            map(results => ({ query: trimmed, results })),
            catchError(() =>
              of({ query: trimmed, results: [] as UserSearchResult[] })
            )
          );
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(({ query, results }) => {
        if (!query) {
          this.contactResults.set([]);
          this.loadingContacts.set(false);
          return;
        }

        this.contactResults.set(results);
        this.loadingContacts.set(false);
      });
  }

  /*
  |--------------------------------------------------------------------------
  | COMPUTED
  |--------------------------------------------------------------------------
  */

  readonly selectedChat = computed(() =>

    this.chats().find(
      chat => chat.id === this.selectedChatId()
    ) ?? null
  );

  searchContacts(query: string): void {
    this.searchQuery$.next(query);
  }

  selectContact(contact: UserSearchResult): void {
    this.selectedChatId.set(null);
    this.selectedContact.set(contact);
    this.messages.set([]);
    this.loadingMessages.set(false);
  }

  clearActiveConversation(): void {
    this.selectedChatId.set(null);
    this.selectedContact.set(null);
    this.pendingContactNames.set([]);
    this.messages.set([]);
    this.loadingMessages.set(false);
    this.sendingMessage.set(false);
  }

  getContactDisplayName(contact: UserSearchResult): string {
    const username = contact.username?.trim();
    if (username) {
      return username;
    }

    const fullName = contact.fullName?.trim();
    if (fullName) {
      return fullName;
    }

    const firstName = contact.firstName?.trim() ?? '';
    const lastName = contact.lastName?.trim() ?? '';
    const combined = `${firstName} ${lastName}`.trim();

    if (combined) {
      return combined;
    }

    const email = contact.email?.trim();
    if (email) {
      return email;
    }

    return 'Unknown user';
  }

  /*
  |--------------------------------------------------------------------------
  | LOAD USER CHATS
  |--------------------------------------------------------------------------
  */

  loadChats(): void {

    this.loadingChats.set(true);

    this.chatApi.getUserChats()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({

        next: (chats) => {

          this.chats.set(chats);
          this.syncUnreadBadgeFromChats(chats);
          this.chatsLoaded.set(true);

          const pendingNames = this.pendingContactNames();
          if (pendingNames.length > 0) {
            const match = chats.find(chat =>
              chat.type !== 'GROUP' &&
              pendingNames.includes(chat.name.trim().toLowerCase())
            );

            if (match) {
              this.pendingContactNames.set([]);
              this.selectChat(match.id);
            }
          }

          this.loadingChats.set(false);
        },

        error: (error) => {

          console.error(error);

          this.chatsLoaded.set(false);
          this.loadingChats.set(false);
        }
      });
  }

  ensureChatsLoaded(): void {
    if (this.chatsLoaded() || this.loadingChats()) {
      return;
    }

    this.loadChats();
  }

  setChatPageActive(active: boolean): void {
    this.chatPageActive.set(active);

    if (active) {
      const selectedChatId = this.selectedChatId();

      if (selectedChatId !== null) {
        this.markChatAsRead(selectedChatId);
      }
    }
  }

  /*
  |--------------------------------------------------------------------------
  | SELECT CHAT
  |--------------------------------------------------------------------------
  */

  selectChat(chatId: number): void {

    this.selectedContact.set(null);
    this.pendingContactNames.set([]);
    this.selectedChatId.set(chatId);
    this.messages.set([]);
    this.markChatAsRead(chatId);

    this.loadMessages(chatId);
  }

  markChatAsRead(chatId: number): void {
    const unreadInChat = this.chats()
      .find(chat => chat.id === chatId)
      ?.unreadCount ?? 0;

    this.chats.update(chats =>
      chats.map(chat =>
        chat.id === chatId
          ? {
              ...chat,
              unreadCount: 0
            }
          : chat
      )
    );
    this.decrementUnreadBadge(unreadInChat);
  }

  /*
  |--------------------------------------------------------------------------
  | LOAD MESSAGES
  |--------------------------------------------------------------------------
  */

  loadMessages(chatId: number): void {

    this.loadingMessages.set(true);

    this.chatApi.getChatMessages(chatId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({

        next: (messages) => {

          this.messages.set(messages);

          this.loadingMessages.set(false);
        },

        error: (error) => {

          console.error(error);

          this.loadingMessages.set(false);
        }
      });
  }

  /*
  |--------------------------------------------------------------------------
  | SEND TEXT MESSAGE
  |--------------------------------------------------------------------------
  */

  sendMessage(content: string): void {

    const chatId =
        this.selectedChatId();
    const contact =
        this.selectedContact();
    const trimmedContent = content.trim();

    if (!trimmedContent) {
      return;
    }

    if (!chatId && !contact) {
      return;
    }

    this.sendingMessage.set(true);

    let request: MessageRequest;
    const optimisticMessage = this.createOptimisticMessage(trimmedContent);

    if (chatId) {
      request = {
        chatId,
        content: trimmedContent
      };
      this.appendLocalMessage(optimisticMessage);
      this.updateChatPreview(chatId, trimmedContent, optimisticMessage.createdAt);
    } else if (contact) {
      request = {
        receiverId: contact.id,
        content: trimmedContent
      };
      this.appendLocalMessage(optimisticMessage);

      this.pendingContactNames.set(
        this.resolveContactMatchNames(contact)
      );
    } else {
      this.sendingMessage.set(false);
      return;
    }

    this.chatApi.sendMessage(request)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({

        next: (message) => {

          this.sendingMessage.set(false);
          const savedMessage = this.resolveSavedMessage(message, optimisticMessage, trimmedContent);
          this.replaceLocalMessage(optimisticMessage.id, savedMessage);

          if (chatId) {
            this.updateChatPreview(chatId, savedMessage.content || trimmedContent, savedMessage.createdAt);
          } else {
            this.loadChats();
          }
        },

        error: (error) => {

          console.error(error);

          this.markLocalMessageFailed(optimisticMessage.id);
          this.sendingMessage.set(false);
        }
      });
  }

  /*
  |--------------------------------------------------------------------------
  | SEND MEDIA MESSAGE
  |--------------------------------------------------------------------------
  */

  sendMediaMessage(
      file: File
  ): void {

    const chatId =
        this.selectedChatId();

    if (!chatId) {
      return;
    }

    this.sendingMessage.set(true);

    const request: MessageRequest = {

      chatId,

      content: file.name
    };

    this.chatApi.sendMediaMessage(
        request,
        file
    )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({

      next: (message) => {

        if (message) {
          this.appendLocalMessage(message);
          if (chatId) {
            this.updateChatPreview(chatId, this.getMessagePreview(message), message.createdAt);
          }
        } else {
          this.loadMessages(chatId);
        }
        this.sendingMessage.set(false);
      },

      error: (error) => {

        console.error(error);

        this.sendingMessage.set(false);
      }
    });
  }

  /*
  |--------------------------------------------------------------------------
  | WEBSOCKET NOTIFICATION
  |--------------------------------------------------------------------------
  */

pushIncomingNotification(
    notification: Notification
): void {
  let notificationMatchedLoadedChat = false;
  const chatId = this.toSafeNumber(notification.chatId);
  const selectedChatId = this.selectedChatId();
  const activeChatOpen = this.chatPageActive() && selectedChatId !== null && chatId === selectedChatId;

  /*
  |----------------------------------------------------------
  | Update opened conversation
  |----------------------------------------------------------
  */

  if (activeChatOpen) {

    const message: Message = {

      id: this.toSafeNumber(notification.messageId),

      chatId,

      content: notification.content ?? '',

      senderId: this.toSafeNumber(notification.senderId),

      type: notification.messageType,

      createdAt: notification.createdAt,

      status: 'SENT'
    };

    this.appendLocalMessage(message);

    
  }

  if (!activeChatOpen) {
    this.incrementUnreadBadge();
  }

  /*
  |----------------------------------------------------------
  | Update sidebar preview
  |----------------------------------------------------------
  */

  this.chats.update(chats =>

    chats.map(chat => {

      if (chat.id !== chatId) {
        return chat;
      }

      notificationMatchedLoadedChat = true;

      return {

        ...chat,

        lastMessage:this.resolveNotificationPreview(notification),
          unreadCount : !activeChatOpen ? (chat.unreadCount ?? 0) + 1 : chat.unreadCount ,
          lastMessageDate:
          notification.createdAt
      };
    })
  );

  if (!notificationMatchedLoadedChat) {
    this.loadChats();
  }
}

 private resolveNotificationPreview(
    notification: Notification
): string {

  switch (notification.messageType) {

    case MessageType.IMAGE:
      return '📷 Image';

    case MessageType.VIDEO:
      return '🎥 Video';

    case MessageType.AUDIO:
      return '🎵 Audio';

    case MessageType.FILE:
      return '📎 File';

    default:
      return notification.content;
  }
}

private createOptimisticMessage(content: string): Message {
  return {
    id: this.tempMessageId--,
    content,
    senderId: this.resolveCurrentUserId(),
    type: MessageType.TEXT,
    status: 'SENDING',
    createdAt: new Date().toISOString()
  };
}

private appendLocalMessage(message: Message): void {
  this.messages.update(messages => {
    const messageId = this.toSafeNumber(message.id);
    const exists = messages.some(existingMessage => this.toSafeNumber(existingMessage.id) === messageId);

    return exists
      ? messages.map(existingMessage => this.toSafeNumber(existingMessage.id) === messageId ? message : existingMessage)
      : [
          ...messages,
          message
        ];
  });
}

private replaceLocalMessage(tempId: number, savedMessage: Message): void {
  this.messages.update(messages => {
    const withoutSavedDuplicate = messages.filter(message =>
      this.toSafeNumber(message.id) === tempId ||
      this.toSafeNumber(message.id) !== this.toSafeNumber(savedMessage.id)
    );

    const replaced = withoutSavedDuplicate.map(message =>
      this.toSafeNumber(message.id) === tempId ? savedMessage : message
    );

    return replaced.some(message => this.toSafeNumber(message.id) === this.toSafeNumber(savedMessage.id))
      ? replaced
      : [
          ...replaced,
          savedMessage
        ];
  });
}

private markLocalMessageFailed(messageId: number): void {
  this.messages.update(messages =>
    messages.map(message =>
      message.id === messageId
        ? {
            ...message,
            status: 'FAILED'
          }
        : message
    )
  );
}

private updateChatPreview(chatId: number, preview: string, createdAt: string): void {
  this.chats.update(chats =>
    chats.map(chat =>
      chat.id === chatId
        ? {
            ...chat,
            lastMessage: preview,
            lastMessageDate: createdAt
          }
        : chat
    )
  );
}

private syncUnreadBadgeFromChats(chats: Chat[]): void {
  const unreadTotal = chats.reduce(
    (total, chat) => total + Math.max(0, chat.unreadCount ?? 0),
    0
  );

  this.totalUnreadCount.update(currentCount => Math.max(currentCount, unreadTotal));
}

private incrementUnreadBadge(): void {
  this.totalUnreadCount.update(count => count + 1);
}

private decrementUnreadBadge(amount: number): void {
  if (amount <= 0) {
    return;
  }

  this.totalUnreadCount.update(count => Math.max(0, count - amount));
}

private getMessagePreview(message: Message): string {
  switch (message.type) {
    case MessageType.IMAGE:
      return 'Image';

    case MessageType.VIDEO:
      return 'Video';

    case MessageType.AUDIO:
      return 'Audio';

    case MessageType.FILE:
      return message.content?.trim() || 'File';

    default:
      return message.content;
  }
}

private resolveSavedMessage(response: Message | null, fallback: Message, content: string): Message {
  if (response && this.toSafeNumber(response.id) > 0) {
    return {
      ...response,
      chatId: response.chatId ? this.toSafeNumber(response.chatId) : fallback.chatId,
      content: response.content ?? content,
      senderId: this.toSafeNumber(response.senderId),
      status: response.status ?? 'SENT',
      createdAt: response.createdAt ?? fallback.createdAt
    };
  }

  return {
    ...fallback,
    content,
    status: 'SENT'
  };
}

private resolveCurrentUserId(): number {
  const payload = this.tokenService.decodePayload();
  const parsed = Number(payload?.userId ?? payload?.sub);

  return Number.isFinite(parsed) ? parsed : 0;
}

private toSafeNumber(value: number | string | null | undefined): number {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : 0;
}
  /*
  |--------------------------------------------------------------------------
  | CLEAR STATE
  |--------------------------------------------------------------------------
  */

  clearState(): void {

    this.chats.set([]);

    this.messages.set([]);

    this.selectedChatId.set(null);
    this.selectedContact.set(null);
    this.contactResults.set([]);
    this.loadingContacts.set(false);
    this.pendingContactNames.set([]);
    this.chatsLoaded.set(false);
    this.totalUnreadCount.set(0);
  }

  private resolveContactMatchNames(
    contact: UserSearchResult
  ): string[] {
    const candidates = [
      contact.username,
      contact.fullName,
      `${contact.firstName ?? ''} ${contact.lastName ?? ''}`.trim(),
      contact.email
    ];

    const names = new Set<string>();

    candidates.forEach((value) => {
      const trimmed = value?.trim();
      if (trimmed) {
        names.add(trimmed.toLowerCase());
      }
    });

    return Array.from(names);
  }
}
