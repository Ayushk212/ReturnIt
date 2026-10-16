import { Schema, model, Document, Types } from 'mongoose';

export interface IConversation extends Document {
  _id: Types.ObjectId;
  participants: Types.ObjectId[];
  item: Types.ObjectId;
  lastMessageAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ConversationSchema = new Schema<IConversation>(
  {
    participants: {
      type: [{ type: Schema.Types.ObjectId, ref: 'User' }],
      required: true,
      validate: [(val: Types.ObjectId[]) => val.length === 2, 'Conversation requires exactly 2 participants'],
    },
    item: { type: Schema.Types.ObjectId, ref: 'Item', required: true, index: true },
    lastMessageAt: { type: Date, default: Date.now, index: true },
  },
  {
    timestamps: true,
  },
);

ConversationSchema.index({ participants: 1 });
ConversationSchema.index({ item: 1, participants: 1 }, { unique: true });

export const Conversation = model<IConversation>('Conversation', ConversationSchema);
