export interface IMessage {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  readBy: string[];
  clientMessageId: string;
  createdAt: Date;
  updatedAt: Date;
}
