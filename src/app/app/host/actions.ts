"use server";

import { requireActiveMembership } from "@/lib/auth/dal";
import { createHostCredentials } from "@/lib/host/credentials";
import { hostCredentialCookieName, sealHostCredentials } from "@/lib/host/credential-cookie";
import { emptyHostCredentialState, readCurrentHostCredentials, type HostCredentialState } from "@/lib/host/current-credentials";
import { createClient } from "@/lib/supabase/server";
import type { DatabaseWithPendingOnboarding } from "@/types/pending-database.types";
import { cookies } from "next/headers";

export type { HostCredentialState } from "@/lib/host/current-credentials";

export async function getHostCredentials(refresh = false): Promise<HostCredentialState> {
  const context = await requireActiveMembership(["host"]);

  const serverSecret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serverSecret) {
    return { ...emptyHostCredentialState, error: "Credential generation is not configured." };
  }

  try {
    const identity = { userId: context.user.id, membershipId: context.membership.id, organizationId: context.organization.id };
    const current = await readCurrentHostCredentials(identity, serverSecret);
    if (current && !refresh) return current;
    const supabase = await createClient<DatabaseWithPendingOnboarding>();
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const credential = createHostCredentials(serverSecret);
      const { data, error } = await supabase.rpc("issue_host_credentials", {
        p_host_code_hash: credential.hostCodeHash,
        p_invitation_token_hash: credential.invitationTokenHash,
      });
      const result = data?.[0];
      if (error?.code === "23505" && attempt < 2) continue;
      if (error || !result) {
        const message = error?.message === "host credential issuance is rate limited"
          ? "Too many refreshes. Please wait a minute and try again."
          : "Fresh credentials could not be created. Please try again.";
        return { ...(current ?? emptyHostCredentialState), error: message };
      }
      const expiresAt = result.invitation_expires_at;
      const cookieStore = await cookies();
      cookieStore.set(hostCredentialCookieName, sealHostCredentials({
        ...identity,
        invitationToken: credential.invitationToken,
        hostCode: credential.hostCode,
        expiresAt,
      }, serverSecret), {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/app/host",
        maxAge: Math.max(1, Math.min(300, Math.floor((Date.parse(expiresAt) - Date.now()) / 1000))),
      });
      return {
        error: null,
        invitationPath: `/visit/register?token=${encodeURIComponent(credential.invitationToken)}`,
        hostCode: credential.hostCode,
        expiresAt,
      };
    }
    return { ...(current ?? emptyHostCredentialState), error: "Fresh credentials could not be created. Please try again." };
  } catch {
    return { ...emptyHostCredentialState, error: "Credentials are temporarily unavailable. Please try again." };
  }
}
