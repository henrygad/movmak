import "server-only";

import { createClient } from "@/lib/supabase/server";
import { hashInvitationToken, isPlausibleInvitationToken } from "@/lib/auth/invitations";
import type { DatabaseWithPendingOnboarding } from "@/types/pending-database.types";

export async function previewJoinLink(token: string) {
  if (!isPlausibleInvitationToken(token)) return null;
  const supabase = await createClient<DatabaseWithPendingOnboarding>();
  const { data, error } = await supabase.rpc("preview_organization_join_link", { p_token_hash: hashInvitationToken(token) });
  if (error) {
    if (error.code === "PGRST202") return undefined;
    throw new Error("Unable to check the organization join link.");
  }
  return data?.[0] ?? null;
}

export async function getMyJoinRequest() {
  const supabase = await createClient<DatabaseWithPendingOnboarding>();
  const { data, error } = await supabase.rpc("get_my_organization_join_request");
  if (error) {
    if (error.code === "PGRST202") return null;
    throw new Error("Unable to check your membership request.");
  }
  return data?.[0] ?? null;
}
