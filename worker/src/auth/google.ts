/* Google sign-in without Firebase: the browser gets an ID token from Google Identity Services and we
 * verify its signature against Google's published keys. Only openid/email/profile are ever asked for. */
import { createRemoteJWKSet, jwtVerify } from "jose";
import { ApiError, MESSAGES } from "../lib/http.ts";

const GOOGLE_KEYS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));
const GOOGLE_ISSUERS = ["https://accounts.google.com", "accounts.google.com"];

export interface GoogleIdentity {
  sub: string;
  email: string;
  name: string;
  picture: string | null;
}

export async function verifyGoogleIdToken(idToken: string, clientId: string): Promise<GoogleIdentity> {
  try {
    const { payload } = await jwtVerify(idToken, GOOGLE_KEYS, { issuer: GOOGLE_ISSUERS, audience: clientId });
    const email = typeof payload.email === "string" ? payload.email.toLowerCase() : null;
    if (!payload.sub || !email || payload.email_verified !== true) throw new Error("Unverified Google account");
    return {
      sub: payload.sub,
      email,
      name: typeof payload.name === "string" && payload.name.trim() ? payload.name.trim() : email.split("@")[0],
      picture: typeof payload.picture === "string" ? payload.picture : null,
    };
  } catch {
    throw new ApiError(401, MESSAGES.signIn);
  }
}
