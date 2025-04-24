import mongoose from 'mongoose';
import * as bcrypt from 'bcrypt';

export interface IUser extends mongoose.Document {
  webflowToken: string;
  tokenName: string;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new mongoose.Schema<IUser>(
  {
    webflowToken: {
      type: String,
      required: [true, 'Webflow token is required'],
    },
    tokenName: {
      type: String,
      required: [true, 'Token name is required'],
      trim: true,
    },
  },
  { timestamps: true }
);

const User = mongoose.model<IUser>('User', UserSchema);

export default User; 