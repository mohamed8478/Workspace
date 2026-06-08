import { MessageType } from './message-type.enum';

export interface Message {
  id: number;

  chatId?: number;

  content: string;

  senderId: number;

  type: MessageType;

  status ?: 'SENDING' | 'SENT' | 'SEEN' | 'FAILED';

  media?: Array<string>;

  createdAt: string;

}
