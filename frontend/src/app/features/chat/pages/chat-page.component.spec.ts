import { ComponentFixture, TestBed } from '@angular/core/testing';
import { computed, signal } from '@angular/core';

import { ChatPageComponent } from './chat-page.component';
import { ChatService } from '../services/chat.service';
import { Chat } from '../models/chat.model';
import { Message } from '../models/message.model';

class ChatServiceStub {
  chats = signal<Chat[]>([]);
  messages = signal<Message[]>([]);
  selectedChatId = signal<number | null>(null);
  selectedContact = signal(null);
  loadingChats = signal(false);
  loadingMessages = signal(false);
  sendingMessage = signal(false);
  selectedChat = computed(() => null);

  loadChats(): void {}
  setChatPageActive(): void {}
  clearActiveConversation(): void {}
  selectChat(): void {}
  sendMessage(): void {}
  sendMediaMessage(): void {}
}

describe('ChatPageComponent', () => {
  let component: ChatPageComponent;
  let fixture: ComponentFixture<ChatPageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChatPageComponent],
      providers: [
        { provide: ChatService, useClass: ChatServiceStub }
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ChatPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
