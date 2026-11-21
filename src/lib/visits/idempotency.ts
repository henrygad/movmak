import { createHash, createHmac } from "node:crypto";
import { hashVisitQrToken } from "./credentials";

export const idempotencyKeyPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function hashIdempotencyKey(key: string) {
  return `\\x${createHash("sha256").update(key, "utf8").digest("hex")}`;
}

export function fingerprintVisitInput(input: {
  fullName: string;
  phone: string;
  purpose: string;
  companionCount: number;
}) {
  const canonical = JSON.stringify({
    companionCount: input.companionCount,
    fullName: input.fullName.trim().replace(/\s+/g, " "),
    phone: input.phone,
    purpose: input.purpose.trim(),
  });
  return `\\x${createHash("sha256").update(canonical, "utf8").digest("hex")}`;
}

export function fingerprintGateVisitInput(input: {
  fullName: string; phone: string; purpose: string; companionCount: number;
  hostMembershipId: string; hostCodeAttemptId: number | null; phoneNotProvided: boolean;
}) {
  return `\\x${createHash("sha256").update(JSON.stringify({
    companionCount: input.companionCount,
    fullName: input.fullName.trim().replace(/\s+/g, " "),
    hostCodeAttemptId: input.hostCodeAttemptId,
    hostMembershipId: input.hostMembershipId,
    phone: input.phone,
    phoneNotProvided: input.phoneNotProvided,
    purpose: input.purpose.trim(),
  }), "utf8").digest("hex")}`;
}

/** A retry must reproduce the same bearer token because only its hash is kept
 * in PostgreSQL. The scope binds it to the trusted actor or invitation.
 */
export function createIdempotentVisitQrCredential(
  serverSecret: string,
  scope: string,
  idempotencyKey: string,
) {
  const token = createHmac("sha256", serverSecret)
    .update(`movmak:visit:v1:${scope}:${idempotencyKey}`, "utf8")
    .digest("base64url");
  return {
    payload: `movmak:visit:v1:${token}`,
    tokenHash: hashVisitQrToken(token),
  };
}
