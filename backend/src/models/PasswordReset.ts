import { InferSchemaType, Schema, model } from 'mongoose';

/**
 * Password-reset tokens. Only the SHA-256 hash of the token is stored —
 * the raw token exists solely in the (simulated) email delivery channel.
 */
const passwordResetSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// Automatic cleanup of expired reset tokens.
passwordResetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type PasswordResetDocument = InferSchemaType<typeof passwordResetSchema> & { _id: unknown };

export const PasswordResetModel = model('PasswordReset', passwordResetSchema);
