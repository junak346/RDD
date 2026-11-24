/**
 * Typed application errors. Each error maps to a stable machine-readable
 * `code` and an HTTP status. Messages are safe to show to end users —
 * internal details only ever go to the server log.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

export const errors = {
  badRequest: (message = 'The request could not be understood.', details?: unknown) =>
    new ApiError(400, 'BAD_REQUEST', message, details),

  invalidImage: (message = 'The uploaded file is not a supported image.') =>
    new ApiError(400, 'INVALID_IMAGE', message),

  unauthorized: (message = 'Authentication is required.') =>
    new ApiError(401, 'AUTH_REQUIRED', message),

  invalidCredentials: (message = 'Invalid email or password.') =>
    new ApiError(401, 'INVALID_CREDENTIALS', message),

  invalidToken: (message = 'The session token is invalid or has expired.') =>
    new ApiError(401, 'INVALID_TOKEN', message),

  forbidden: (message = 'You do not have permission to perform this action.') =>
    new ApiError(403, 'FORBIDDEN', message),

  notFound: (message = 'The requested resource was not found.') =>
    new ApiError(404, 'NOT_FOUND', message),

  conflict: (message = 'The resource already exists.', details?: unknown) =>
    new ApiError(409, 'CONFLICT', message, details),

  emailTaken: () => new ApiError(409, 'EMAIL_TAKEN', 'An account with this email already exists.'),

  payloadTooLarge: (message = 'The uploaded file is too large.') =>
    new ApiError(413, 'PAYLOAD_TOO_LARGE', message),

  validation: (message = 'The request contains invalid data.', details?: unknown) =>
    new ApiError(422, 'VALIDATION_ERROR', message, details),

  rateLimited: (message = 'Too many requests — please try again later.') =>
    new ApiError(429, 'RATE_LIMITED', message),

  aiUnavailable: (message = 'The AI analysis service is currently unavailable.') =>
    new ApiError(503, 'AI_SERVICE_UNAVAILABLE', message),

  aiInvalidResponse: (message = 'The AI service returned an unexpected response.') =>
    new ApiError(502, 'AI_INVALID_RESPONSE', message),

  databaseUnavailable: (message = 'The database is currently unavailable.') =>
    new ApiError(503, 'DATABASE_UNAVAILABLE', message),

  internal: (message = 'An unexpected error occurred.') =>
    new ApiError(500, 'INTERNAL_ERROR', message),
};
