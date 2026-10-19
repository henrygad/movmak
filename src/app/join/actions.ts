"use server";

import { redirect } from "next/navigation";
import { getAccessContext } from "@/lib/auth/dal";
import { hashInvitationToken, isPlausibleInvitationToken } from "@/lib/auth/invitations";
import { createClient } from "@/lib/supabase/server";
import type { DatabaseWithPendingOnboarding } from "@/types/pending-database.types";

export type JoinState = { error: string | null; message: string | null };

export async function acceptInvitation(_state: JoinState, formData: FormData): Promise<JoinState> {
  const token = formData.get("token")?.toString() ?? "";
  if (!isPlausibleInvitationToken(token)) return { error: "This join link is invalid or unavailable.", message: null };
  const context = await getAccessContext();
  if (context.kind === "unauthenticated") redirect(`/login?next=${encodeURIComponent(`/join?token=${token}`)}`);
  if (context.kind === "active") redirect("/app");
  if (context.kind === "inactive") redirect("/access-inactive");

  const supabase = await createClient<DatabaseWithPendingOnboarding>();
  const { error } = await supabase.rpc("request_organization_membership", { p_token_hash: hashInvitationToken(token) });
  if (error) return { error: "This join link is invalid, expired, revoked, or you already have a membership or pending request.", message: null };
  return { error: null, message: "Your request was sent. An organization administrator must approve it before you receive access." };
}
