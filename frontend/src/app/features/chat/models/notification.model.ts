import { MessageType } from './message-type.enum';

export interface Notification {

  messageId: number;

  chatId: number;

  content: string;

  senderId: number;

  messageType: MessageType;

  mediaUrl?: string;

  createdAt: string;
}