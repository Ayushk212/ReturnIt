import { Schema, model, Document, Types } from 'mongoose';

export interface IMessage extends Document {
  _id: Types.ObjectId;
  conversation: Types.ObjectId;
  sender: Types.ObjectId;
  content: string;
  readBy: Types.ObjectId[];
  clientMessageId: string;
  createdAt: Date;
  updatedAt: Date;
}

const MessageSchema = new Schema<IMessage>(
  {
    conversation: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true, index: true },
    sender: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    content: { type: String, required: true, trim: true, maxlength: 2000 },
    readBy: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    clientMessageId: { type: String, required: true, index: true },
  },
  {
    timestamps: true,
  },
);

MessageSchema.index({ conversation: 1, createdAt: 1 });
MessageSchema.index({ clientMessageId: 1, sender: 1 }, { unique: true });

export const Message = model<IMessage>('Message', MessageSchema);
