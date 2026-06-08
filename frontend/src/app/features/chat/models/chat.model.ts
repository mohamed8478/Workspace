export interface Chat {

  id: number;

  name: string;

  type? : 'GROUP' | 'DIRECT';

  lastMessage?: string;

  lastMessageDate?: string;

  unreadCount?: number;
}