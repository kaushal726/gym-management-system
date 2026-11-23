import type { ContentfulStatusCode } from "hono/utils/http-status";

/** An error the API sends back as `{ error, field? }`. Messages stay generic: they never name a specific record. */
export class ApiError extends Error {
  readonly status: ContentfulStatusCode;
  readonly field?: string;
  readonly code?: string;

  constructor(status: ContentfulStatusCode, message: string, field?: string, code?: string) {
    super(message);
    this.status = status;
    this.field = field;
    this.code = code;
  }
}

export const MESSAGES = {
  badInput: "Please check the highlighted field and try again.",
  signIn: "Please sign in to continue.",
  forbidden: "You don't have access to this.",
  notFound: "We couldn't find what you were looking for.",
  conflict: "This was changed by someone else. Refresh and try again.",
  duplicatePhone: "This phone number is already registered at this gym. Please see the desk.",
  server: "Something went wrong. Please try again.",
  gymPaused: "This gym's GymDesk account is paused. Please contact GymDesk support.",
  gymClosedToPublic: "This gym isn't taking sign-ups or check-ins right now. Please contact the desk.",
} as const;

export const badInput = (field: string, message: string = MESSAGES.badInput) => new ApiError(400, message, field);
export const notFound = () => new ApiError(404, MESSAGES.notFound);
export const forbidden = () => new ApiError(403, MESSAGES.forbidden);
export const conflict = (message: string = MESSAGES.conflict) => new ApiError(409, message);
