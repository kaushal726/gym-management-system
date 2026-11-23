/* Who may open a claim link. The desk sends it to the member's WhatsApp; it must link the member's own Gmail. */

/** Why a signed-in account can't use a claim link. */
export type ClaimBlock = "STAFF" | "OTHER_EMAIL" | "ALREADY_LINKED";

export const CLAIM_BLOCK_MESSAGE: Record<ClaimBlock, string> = {
  STAFF: "You're on this gym's team, so this link can't link your account. Open it on the member's own phone.",
  OTHER_EMAIL: "This link is for a different Gmail. Sign in with the Gmail the desk added, or ask the desk to change it.",
  ALREADY_LINKED: "This membership is already linked to another Gmail. Ask the desk to unlink it first.",
};

export interface ClaimInfo {
  gymName: string;
  gymSlug: string;
  memberName: string;
  /** Set when the signed-in account may not use this link. */
  blocked: ClaimBlock | null;
}
