import "server-only";

import { cookies } from "next/headers";
import { createServiceClient } from "@/lib/supabase/service";
import { hashHostCode, hashInvitationToken } from "@/lib/host/credentials";
import { hostCredentialCookieName, hostCredentialsBelongTo, unsealHostCredentials } from "@/lib/host/credential-cookie";

export type HostCredentialState = {
  error: string | null;
  invitationPath: string | null;
  hostCode: string | null;
  expiresAt: string | null;
};

export const emptyHostCredentialState: HostCredentialState = {
  error: null, invitationPath: null, hostCode: null, expiresAt: null,
};

export async function readCurrentHostCredentials(identity: {
  userId: string;
  membershipId: string;
  organizationId: string;
}, serverSecret: string): Promise<HostCredentialState | null> {
  const raw = (await cookies()).get(hostCredentialCookieName)?.value;
  if (!raw) return null;
  const stored = unsealHostCredentials(raw, serverSecret);
  if (!stored || !hostCredentialsBelongTo(stored, identity)) return null;

  // The encrypted cookie preserves the raw pair for this browser only. The
  // database remains authoritative if the pair was consumed or revoked elsewhere.
  const now = new Date().toISOString();
  const service = createServiceClient();
  const [invitation, code] = await Promise.all([
    service.from("invitation_credentials").select("expires_at")
      .eq("organization_id", identity.organizationId)
      .eq("host_membership_id", identity.membershipId)
      .eq("token_hash", hashInvitationToken(stored.invitationToken))
      .is("consumed_at", null).is("revoked_at", null).gt("expires_at", now).maybeSingle(),
    service.from("host_verification_codes").select("expires_at")
      .eq("organization_id", identity.organizationId)
      .eq("host_membership_id", identity.membershipId)
      .eq("code_hash", hashHostCode(stored.hostCode, serverSecret))
      .is("revoked_at", null).gt("expires_at", now).maybeSingle(),
  ]);
  if (invitation.error || code.error) throw new Error("Unable to verify current host credentials.");
  if (!invitation.data || !code.data || invitation.data.expires_at !== code.data.expires_at
    || invitation.data.expires_at !== stored.expiresAt) return null;

  return {
    error: null,
    invitationPath: `/visit/register?token=${encodeURIComponent(stored.invitationToken)}`,
    hostCode: stored.hostCode,
    expiresAt: stored.expiresAt,
  };
}
