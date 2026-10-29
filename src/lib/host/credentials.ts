import { createHash, createHmac, randomBytes, randomInt } from "node:crypto";

export function createHostCredentials(serverSecret: string) {
  if (serverSecret.trim().length < 32) {
    throw new Error("A strong server credential is required.");
  }

  const invitationToken = randomBytes(32).toString("base64url");
  const hostCode = randomInt(0, 10_000).toString().padStart(4, "0");

  return {
    invitationToken,
    invitationTokenHash: hashInvitationToken(invitationToken),
    hostCode,
    hostCodeHash: hashHostCode(hostCode, serverSecret),
  };
}

export function hashInvitationToken(token: string) {
  return toPostgresBytea(createHash("sha256").update(token, "utf8").digest("hex"));
}

export function hashHostCode(code: string, serverSecret: string) {
  return toPostgresBytea(
    createHmac("sha256", serverSecret)
      .update(`movmak:host-code:v1:${code}`, "utf8")
      .digest("hex"),
  );
}

function toPostgresBytea(hex: string) {
  return `\\x${hex}`;
}
