import type { SessionUser, StaffGym } from "../../shared/api.ts";
import type { GymRow } from "./db/rows.ts";

export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  /** OAuth Web client id from Google Cloud Console. Empty until it is set up. */
  GOOGLE_CLIENT_ID?: string;
  VAPID_PUBLIC_KEY?: string;
  VAPID_SUBJECT?: string;
  /** Secret: the VAPID private key as a JWK. */
  VAPID_PRIVATE_JWK?: string;
  /** Secret: comma-separated emails allowed into /platform. */
  PLATFORM_ADMIN_EMAILS?: string;
  /** "1" lets anyone signed in create their own gym (self-serve SaaS signup). */
  ALLOW_GYM_SIGNUP?: string;
  /** The one public address (Cloudflare Pages). Requests to any other host are redirected there. Empty locally. */
  PUBLIC_URL?: string;
  /** "1" only in .dev.vars: enables the local sign-in without Google and the manual cron route. */
  DEV_AUTH?: string;
}

export interface StaffContext {
  gym: GymRow;
  role: StaffGym["role"];
  /** The platform admin looking at a gym that is not theirs: sees what its owner sees, changes nothing. */
  viewOnly: boolean;
}

export type AppEnv = {
  Bindings: Env;
  Variables: {
    user: SessionUser | null;
    staff: StaffContext;
  };
};
