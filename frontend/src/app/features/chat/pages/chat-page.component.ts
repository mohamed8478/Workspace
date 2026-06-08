import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChatComponent } from '../components/chat/chat.component';
import { MessageComponent } from '../components/message/message.component';
import { ChatService } from '../services/chat.service';

@Component({
  selector: 'app-chat-page',
  standalone: true,
  imports: [CommonModule, ChatComponent, MessageComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './chat-page.component.html',
  styleUrl: './chat-page.component.css'
  // styleUrl : '../../../shared/style/chat.css'
})
export class ChatPageComponent implements OnInit, OnDestroy {

  private readonly chatService = inject(ChatService);

  ngOnInit(): void {
    this.chatService.setChatPageActive(true);
    this.chatService.clearActiveConversation();
    this.chatService.loadChats();
  }

  ngOnDestroy(): void {
    this.chatService.setChatPageActive(false);
  }

}
