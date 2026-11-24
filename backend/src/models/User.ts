import { InferSchemaType, Schema, model } from 'mongoose';

export const USER_ROLES = ['user', 'inspector', 'admin'] as const;
export type UserRole = (typeof USER_ROLES)[number];

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
    },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: USER_ROLES, default: 'user' },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        delete (ret as Record<string, unknown>).passwordHash;
        return ret;
      },
    },
  },
);

userSchema.index({ createdAt: -1 });

export type UserDocument = InferSchemaType<typeof userSchema> & { _id: unknown };

export const UserModel = model('User', userSchema);
