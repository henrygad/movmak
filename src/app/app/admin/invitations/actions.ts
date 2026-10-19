"use server";

import { createInvitationCredential, isOrganizationRole, isValidInvitationEmail, normalizeEmail } from "@/lib/auth/invitations";
import { requireActiveMembership } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import type { DatabaseWithPendingOnboarding } from "@/types/pending-database.types";
import { revalidatePath } from "next/cache";
import { isMembershipStatus } from "@/lib/admin/members";

export type InvitationState = { error: string | null; invitationPath: string | null };

export async function createInvitation(_state: InvitationState, formData: FormData): Promise<InvitationState> {
  const context = await requireActiveMembership(["admin"]);
  const email = normalizeEmail(formData.get("email")?.toString() ?? "");
  const roleValue = formData.get("role")?.toString() ?? "";
  if (!isValidInvitationEmail(email)) return { error: "Enter a valid email address.", invitationPath: null };
  if (!isOrganizationRole(roleValue)) return { error: "Choose a valid organization role.", invitationPath: null };

  const credential = createInvitationCredential();
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
  const supabase = await createClient<DatabaseWithPendingOnboarding>();
  const { error } = await supabase.rpc("create_membership_invitation", {
    p_expires_at: expiresAt,
    p_invited_email: email,
    p_organization_id: context.organization.id,
    p_role: roleValue,
    p_token_hash: credential.tokenHash,
  });
  if (error) return { error: "The invitation could not be created.", invitationPath: null };
  return { error: null, invitationPath: `/join?token=${encodeURIComponent(credential.token)}` };
}

export type MemberActionState = { error: string | null; message: string | null };

export async function updateMembership(_state: MemberActionState, formData: FormData): Promise<MemberActionState> {
  const context = await requireActiveMembership(["admin"]);
  const membershipId = formData.get("membershipId")?.toString() ?? "";
  const role = formData.get("role")?.toString() ?? "";
  const status = formData.get("status")?.toString() ?? "";
  if (!membershipId || !isOrganizationRole(role) || !isMembershipStatus(status)) return { error: "Choose a valid role and status.", message: null };
  const supabase = await createClient<DatabaseWithPendingOnboarding>();
  const { error } = await supabase.rpc("manage_organization_membership", {
    p_membership_id: membershipId, p_organization_id: context.organization.id,
    p_role: role, p_status: status,
  });
  if (error) return { error: "The membership could not be updated. You cannot change your own access or remove the last active administrator.", message: null };
  revalidatePath("/app/admin/invitations");
  return { error: null, message: "Membership updated." };
}

export async function revokeInvitation(invitationId: string): Promise<MemberActionState> {
  const context = await requireActiveMembership(["admin"]);
  const supabase = await createClient<DatabaseWithPendingOnboarding>();
  const { data, error } = await supabase.rpc("revoke_membership_invitation", {
    p_invitation_id: invitationId, p_organization_id: context.organization.id,
  });
  if (error || !data) return { error: "The invitation is no longer available for revocation.", message: null };
  revalidatePath("/app/admin/invitations");
  return { error: null, message: "Invitation revoked." };
}

export type JoinLinkState = { error: string | null; joinPath: string | null; message: string | null };

export async function createJoinLink(_state: JoinLinkState, formData: FormData): Promise<JoinLinkState> {
  await requireActiveMembership(["admin"]);
  const role = formData.get("role")?.toString() ?? "";
  const durationDays = Number(formData.get("durationDays"));
  if (!isOrganizationRole(role) || ![1, 7, 30].includes(durationDays)) return { error: "Choose a valid role and expiry.", joinPath: null, message: null };
  const credential = createInvitationCredential();
  const supabase = await createClient<DatabaseWithPendingOnboarding>();
  const { error } = await supabase.rpc("create_organization_join_link", {
    p_default_role: role, p_token_hash: credential.tokenHash,
    p_expires_at: new Date(Date.now() + durationDays * 86_400_000).toISOString(),
  });
  if (error) return { error: "The join link could not be created.", joinPath: null, message: null };
  revalidatePath("/app/admin/invitations");
  return { error: null, joinPath: `/join?token=${encodeURIComponent(credential.token)}`, message: "Join link created. Copy it now; the secret is shown once." };
}

export async function rotateJoinLink(joinLinkId: string, durationDays: number): Promise<JoinLinkState> {
  await requireActiveMembership(["admin"]);
  if (![1, 7, 30].includes(durationDays)) return { error: "Choose a valid expiry.", joinPath: null, message: null };
  const credential = createInvitationCredential();
  const supabase = await createClient<DatabaseWithPendingOnboarding>();
  const { error } = await supabase.rpc("rotate_organization_join_link", {
    p_join_link_id: joinLinkId, p_token_hash: credential.tokenHash,
    p_expires_at: new Date(Date.now() + durationDays * 86_400_000).toISOString(),
  });
  if (error) return { error: "The join link could not be rotated.", joinPath: null, message: null };
  revalidatePath("/app/admin/invitations");
  return { error: null, joinPath: `/join?token=${encodeURIComponent(credential.token)}`, message: "Link rotated. The previous link is revoked." };
}

export async function revokeJoinLink(joinLinkId: string): Promise<MemberActionState> {
  await requireActiveMembership(["admin"]);
  const supabase = await createClient<DatabaseWithPendingOnboarding>();
  const { data, error } = await supabase.rpc("revoke_organization_join_link", { p_join_link_id: joinLinkId });
  if (error || !data) return { error: "The join link is no longer available.", message: null };
  revalidatePath("/app/admin/invitations");
  return { error: null, message: "Join link revoked." };
}

export async function reviewMembershipRequest(_state: MemberActionState, formData: FormData): Promise<MemberActionState> {
  await requireActiveMembership(["admin"]);
  const requestId = formData.get("requestId")?.toString() ?? "";
  const decision = formData.get("decision")?.toString() ?? "";
  const role = formData.get("role")?.toString() ?? "";
  if (!requestId || !["approve", "reject"].includes(decision) || !isOrganizationRole(role)) return { error: "Choose a valid action and role.", message: null };
  const supabase = await createClient<DatabaseWithPendingOnboarding>();
  const { error } = await supabase.rpc("review_organization_membership_request", { p_assigned_role: role, p_decision: decision, p_request_id: requestId });
  if (error) return { error: "The membership request could not be updated.", message: null };
  revalidatePath("/app/admin/invitations");
  return { error: null, message: decision === "approve" ? "Member approved." : "Request rejected." };
}
