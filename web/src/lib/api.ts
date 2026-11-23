/* Typed JSON calls to the Worker on the same origin. Errors carry the API's message and the field to highlight. */
import type { ApiErrorBody } from "../../../shared/api.ts";

export class ApiRequestError extends Error {
  readonly status: number;
  readonly field?: string;
  readonly code?: string;
  constructor(status: number, message: string, field?: string, code?: string) {
    super(message);
    this.status = status;
    this.field = field;
    this.code = code;
  }
}

const OFFLINE_MESSAGE = "You seem to be offline. Check your internet and try again.";

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      credentials: "same-origin",
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiRequestError(0, OFFLINE_MESSAGE);
  }
  const data = (await res.json().catch(() => null)) as (T & ApiErrorBody) | null;
  if (!res.ok) throw new ApiRequestError(res.status, data?.error ?? "Something went wrong. Please try again.", data?.field, data?.code);
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T = { ok: true }>(path: string, body: unknown = {}) => request<T>("POST", path, body),
  patch: <T = { ok: true }>(path: string, body: unknown) => request<T>("PATCH", path, body),
};

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Something went wrong. Please try again.";
}

export function errorField(err: unknown): string | undefined {
  return err instanceof ApiRequestError ? err.field : undefined;
}
