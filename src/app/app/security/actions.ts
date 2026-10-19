"use server";

import { revalidatePath } from "next/cache";
import { requireActiveMembership } from "@/lib/auth/dal";
import { hashHostCode } from "@/lib/host/credentials";
import { createClient } from "@/lib/supabase/server";
import { hashVisitQrToken, parseVisitQrPayload } from "@/lib/visits/credentials";
import { validateVisitorDetails } from "@/lib/visits/validation";
import type { DatabaseWithPendingOnboarding } from "@/types/pending-database.types";

export type GateResult = { error: string | null; message: string | null };
export type QrPreview = { error: string | null; visit: DatabaseWithPendingOnboarding["public"]["Functions"]["preview_visit_by_qr"]["Returns"][number] | null; payload: string | null };
export type HostVerification = { error: string | null; hostMembershipId: string | null; hostName: string | null; attemptId: number | null };

async function securityClient() {
  const context = await requireActiveMembership(["security"]);
  return { context, supabase: await createClient<DatabaseWithPendingOnboarding>() };
}

export async function previewQr(payload: string): Promise<QrPreview> {
  const token = parseVisitQrPayload(payload);
  if (!token) return { error: "Enter or scan a valid Movmak visit QR.", visit: null, payload: null };
  const { supabase } = await securityClient();
  const { data, error } = await supabase.rpc("preview_visit_by_qr", { p_qr_token_hash: hashVisitQrToken(token) });
  if (error || !data?.[0]) return { error: "This visit QR is invalid, closed, or unavailable.", visit: null, payload: null };
  return { error: null, visit: data[0], payload };
}

export async function checkInByQr(payload: string): Promise<GateResult> {
  const token = parseVisitQrPayload(payload);
  if (!token) return { error: "The visit QR is invalid.", message: null };
  const { supabase } = await securityClient();
  const { data, error } = await supabase.rpc("check_in_visit_by_qr", { p_qr_token_hash: hashVisitQrToken(token) });
  if (error || !data?.[0]) return { error: "This visit cannot be checked in. It may already be inside or closed.", message: null };
  revalidatePath("/app/security/inside");
  return { error: null, message: `${data[0].checked_in_visit_reference} checked in.` };
}

export async function checkOutVisit(visitId: string): Promise<GateResult> {
  const { supabase } = await securityClient();
  const { data, error } = await supabase.rpc("check_out_visit", { p_visit_id: visitId });
  if (error || !data?.[0]) return { error: "This visit cannot be checked out. It may already be closed.", message: null };
  revalidatePath("/app/security/inside");
  return { error: null, message: `${data[0].checked_out_visit_reference} checked out.` };
}

export async function verifyHostCode(code: string): Promise<HostVerification> {
  if (!/^\d{6}$/.test(code)) return { error: "Enter the current six-digit host code.", hostMembershipId: null, hostName: null, attemptId: null };
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) return { error: "Host verification is not configured.", hostMembershipId: null, hostName: null, attemptId: null };
  const { context, supabase } = await securityClient();
  const { data, error } = await supabase.rpc("verify_host_code", { p_code_hash: hashHostCode(code, secret), p_organization_id: context.organization.id });
  const match = data?.[0];
  if (error || !match) return { error: "The code is invalid, expired, or temporarily unavailable.", hostMembershipId: null, hostName: null, attemptId: null };
  return { error: null, hostMembershipId: match.verified_host_membership_id, hostName: match.verified_host_name || "Verified host", attemptId: match.verified_attempt_id };
}

export async function registerGateVisitor(_state: GateResult, formData: FormData): Promise<GateResult> {
  const details = {
    fullName: formData.get("fullName")?.toString() ?? "",
    phone: formData.get("phone")?.toString() ?? "",
    purpose: formData.get("purpose")?.toString() ?? "",
    groupSize: Number(formData.get("groupSize") ?? 1),
  };
  const noPhone = formData.get("phoneNotProvided") === "on";
  const validationError = validateVisitorDetails({ ...details, phone: noPhone ? "N/A" : details.phone });
  if (validationError) return { error: validationError, message: null };
  const hostId = formData.get("hostMembershipId")?.toString() ?? "";
  const attemptValue = formData.get("hostCodeAttemptId")?.toString();
  const attemptId = attemptValue ? Number(attemptValue) : null;
  if (!hostId || (attemptId !== null && (!Number.isInteger(attemptId) || attemptId < 1))) return { error: "Select or verify a valid host.", message: null };

  const { supabase } = await securityClient();
  const { data, error } = await supabase.rpc("register_gate_visit", {
    p_full_name: details.fullName.trim(), p_group_size: details.groupSize,
    p_host_code_attempt_id: attemptId ?? undefined, p_host_membership_id: hostId,
    p_phone: noPhone ? "" : details.phone.trim(), p_phone_not_provided: noPhone,
    p_purpose: details.purpose.trim(),
  });
  if (error || !data?.[0]) return { error: "The visitor could not be registered. Check the host and organization entry mode.", message: null };
  revalidatePath("/app/security/inside");
  return { error: null, message: `${data[0].registered_visit_reference} registered and checked in.` };
}
