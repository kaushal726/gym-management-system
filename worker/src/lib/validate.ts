/* Reads request bodies field by field. Each reader either returns a clean value or throws a 400 that
 * names the field, so the form can highlight it. */
import { isIsoDate, type IsoDate } from "../../../shared/dates.ts";
import { MAX_AMOUNT_PAISE, type Paise } from "../../../shared/money.ts";
import { normalizeIndianMobile } from "../../../shared/phone.ts";
import { badInput } from "./http.ts";

export type Body = Record<string, unknown>;

export function asBody(value: unknown): Body {
  if (value == null || typeof value !== "object" || Array.isArray(value)) throw badInput("body");
  return value as Body;
}

interface TextOptions {
  max?: number;
  min?: number;
}

export function text(body: Body, field: string, options: TextOptions = {}): string {
  const value = body[field];
  if (typeof value !== "string") throw badInput(field);
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (trimmed.length < (options.min ?? 1) || trimmed.length > (options.max ?? 120)) throw badInput(field);
  return trimmed;
}

export function optionalText(body: Body, field: string, options: TextOptions = {}): string | null {
  const value = body[field];
  if (value == null || (typeof value === "string" && value.trim() === "")) return null;
  return text(body, field, options);
}

export function int(body: Body, field: string, min: number, max: number): number {
  const value = body[field];
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) throw badInput(field);
  return value;
}

export function optionalInt(body: Body, field: string, min: number, max: number): number | null {
  return body[field] == null ? null : int(body, field, min, max);
}

export function num(body: Body, field: string, min: number, max: number): number {
  const value = body[field];
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) throw badInput(field);
  return value;
}

export function optionalNum(body: Body, field: string, min: number, max: number): number | null {
  return body[field] == null ? null : num(body, field, min, max);
}

export function bool(body: Body, field: string): boolean {
  const value = body[field];
  if (typeof value !== "boolean") throw badInput(field);
  return value;
}

export function paise(body: Body, field: string, min: Paise = 0): Paise {
  return int(body, field, min, MAX_AMOUNT_PAISE);
}

export function date(body: Body, field: string): IsoDate {
  const value = body[field];
  if (!isIsoDate(value)) throw badInput(field);
  return value;
}

export function optionalDate(body: Body, field: string): IsoDate | null {
  return body[field] == null || body[field] === "" ? null : date(body, field);
}

export function oneOf<T extends string>(body: Body, field: string, allowed: readonly T[]): T {
  const value = body[field];
  if (typeof value !== "string" || !allowed.includes(value as T)) throw badInput(field);
  return value as T;
}

export function optionalOneOf<T extends string>(body: Body, field: string, allowed: readonly T[]): T | null {
  return body[field] == null || body[field] === "" ? null : oneOf(body, field, allowed);
}

export function mobile(body: Body, field: string): string {
  const value = body[field];
  const phone = typeof value === "string" ? normalizeIndianMobile(value) : null;
  if (!phone) throw badInput(field, "Please enter a valid 10-digit mobile number.");
  return phone;
}

export function optionalMobile(body: Body, field: string): string | null {
  return body[field] == null || body[field] === "" ? null : mobile(body, field);
}

export function nested(body: Body, field: string): Body | null {
  const value = body[field];
  if (value == null) return null;
  return asBody(value);
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function email(body: Body, field: string): string {
  const value = text(body, field, { max: 254 }).toLowerCase();
  if (!EMAIL.test(value)) throw badInput(field);
  return value;
}
