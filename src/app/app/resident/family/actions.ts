"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireActiveMembership, requireUser } from "@/lib/auth/dal";
import { createInvitationCredential, hashInvitationToken, isPlausibleInvitationToken, isValidInvitationEmail, normalizeEmail } from "@/lib/auth/invitations";
import { resolveRequestOrigin } from "@/lib/auth/request-origin";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import type { DatabaseWithPendingOnboarding } from "@/types/pending-database.types";

export type FamilyInvitationState = { error: string | null; message: string | null };

export async function inviteFamilyMember(_state: FamilyInvitationState, formData: FormData): Promise<FamilyInvitationState> {
  await requireActiveMembership(["host"]);
  const fullName = formData.get("fullName")?.toString().trim() ?? "";
  const email = normalizeEmail(formData.get("email")?.toString() ?? "");
  if (fullName.length < 2 || fullName.length > 160) return { error: "Enter the family member's full name.", message: null };
  if (!isValidInvitationEmail(email)) return { error: "Enter a valid email address.", message: null };
  const origin = resolveRequestOrigin(await headers());
  if (!origin) return { error: "Invitation links are not configured for this website.", message: null };

  const credential = createInvitationCredential();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const supabase = await createClient<DatabaseWithPendingOnboarding>();
  const { data, error } = await supabase.rpc("create_family_invitation", {
    p_email: email, p_expires_at: expiresAt, p_full_name: fullName, p_token_hash: credential.tokenHash,
  });
  const invitation = data?.[0];
  if (error || !invitation) {
    const duplicate = error?.code === "23505";
    return { error: duplicate ? "A live invitation already exists for that email." : "The family invitation could not be created.", message: null };
  }

  const service = createServiceClient<DatabaseWithPendingOnboarding>();
  await service.rpc("mark_family_invitation_delivery", { p_invitation_id: invitation.invitation_id, p_status: "requested" });
  const callback = new URL("/auth/callback", origin);
  callback.searchParams.set("next", `/family/accept?token=${encodeURIComponent(credential.token)}`);
  const { error: newUserError } = await service.auth.admin.inviteUserByEmail(email, { redirectTo: callback.toString(), data: { full_name: fullName, account_type: "host" } });
  let deliveryError = newUserError;
  if (newUserError) {
    const existing = await service.auth.signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo: callback.toString() } });
    deliveryError = existing.error;
  }
  await service.rpc("mark_family_invitation_delivery", {
    p_invitation_id: invitation.invitation_id,
    p_status: deliveryError ? "failed" : "sent",
    p_provider_code: deliveryError?.code ?? null,
  });
  revalidatePath("/app/resident/family");
  if (deliveryError) return { error: "The invitation was saved, but email delivery failed. You can retry after checking Supabase SMTP settings.", message: null };
  return { error: null, message: "Family invitation sent." };
}

export async function revokeFamilyInvitation(formData: FormData) {
  await requireActiveMembership(["host"]);
  const invitationId = formData.get("invitationId")?.toString() ?? "";
  const supabase = await createClient<DatabaseWithPendingOnboarding>();
  await supabase.rpc("revoke_family_invitation", { p_invitation_id: invitationId });
  revalidatePath("/app/resident/family");
}

export async function acceptFamilyInvitation(formData: FormData) {
  await requireUser();
  const token = formData.get("token")?.toString() ?? "";
  if (!isPlausibleInvitationToken(token)) redirect("/family/accept?error=invalid");
  const supabase = await createClient<DatabaseWithPendingOnboarding>();
  const { error } = await supabase.rpc("accept_family_invitation", { p_token_hash: hashInvitationToken(token) });
  if (error) redirect(`/family/accept?token=${encodeURIComponent(token)}&error=unavailable`);
  redirect("/app/resident");
}
