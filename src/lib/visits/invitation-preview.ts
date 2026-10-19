import "server-only";

import { hashInvitationToken, isPlausibleInvitationToken } from "@/lib/auth/invitations";
import { createServiceClient } from "@/lib/supabase/service";

export type InvitationPreview =
  | { kind: "valid"; organizationName: string; logoUrl: string | null; hostName: string | null }
  | { kind: "invalid" }
  | { kind: "unavailable" };

export async function previewVisitorInvitation(token: string): Promise<InvitationPreview> {
  if (!isPlausibleInvitationToken(token)) return { kind: "invalid" };
  try {
    const service = createServiceClient();
    const now = new Date().toISOString();
    const { data: invitation, error: invitationError } = await service.from("invitation_credentials")
      .select("organization_id, host_membership_id")
      .eq("token_hash", hashInvitationToken(token))
      .is("consumed_at", null).is("revoked_at", null)
      .lte("valid_from", now)
      .gt("expires_at", now).maybeSingle();
    if (invitationError) return { kind: "unavailable" };
    if (!invitation) return { kind: "invalid" };

    const [membership, organization] = await Promise.all([
      service.from("organization_memberships").select("user_id, role, status")
        .eq("id", invitation.host_membership_id)
        .eq("organization_id", invitation.organization_id).maybeSingle(),
      service.from("organizations").select("name, logo_url")
        .eq("id", invitation.organization_id).maybeSingle(),
    ]);
    if (membership.error || organization.error) return { kind: "unavailable" };
    if (!membership.data || membership.data.role !== "host" || membership.data.status !== "active" || !organization.data) return { kind: "invalid" };
    const { data: profile, error: profileError } = await service.from("user_profiles")
      .select("full_name").eq("user_id", membership.data.user_id).maybeSingle();
    if (profileError) return { kind: "unavailable" };
    return {
      kind: "valid",
      organizationName: organization.data.name,
      logoUrl: organization.data.logo_url?.startsWith("https://") ? organization.data.logo_url : null,
      hostName: profile?.full_name ?? null,
    };
  } catch {
    return { kind: "unavailable" };
  }
}
