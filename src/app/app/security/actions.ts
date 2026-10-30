"use server";

import { revalidatePath } from "next/cache";
import { requireActiveMembership } from "@/lib/auth/dal";
import { hashHostCode } from "@/lib/host/credentials";
import { createClient } from "@/lib/supabase/server";
import { hashVisitQrToken, parseVisitQrPayload } from "@/lib/visits/credentials";
import { totalGroupSize, validateVisitorDetails } from "@/lib/visits/validation";
import type { DatabaseWithPendingOnboarding } from "@/types/pending-database.types";

export type GateResult = { error: string | null; message: string | null };
export type QrPreview = { error: string | null; visit: DatabaseWithPendingOnboarding["public"]["Functions"]["preview_visit_by_qr"]["Returns"][number] | null; payload: string | null };
export type QrProcessResult = {
  error: string | null;
  message: string | null;
  visit: QrPreview["visit"];
  resultingStatus: "inside" | "left" | null;
};
export type HostVerification = { error: string | null; hostMembershipId: string | null; hostName: string | null; attemptId: number | null };
export type LocationVerificationState = { error: string | null; message: string | null };

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

export async function processQr(payload: string): Promise<QrProcessResult> {
  const token = parseVisitQrPayload(payload);
  if (!token) return { error: "Scan a valid Movmak visit QR.", message: null, visit: null, resultingStatus: null };

  const { supabase } = await securityClient();
  const qrTokenHash = hashVisitQrToken(token);
  const { data: previewData, error: previewError } = await supabase.rpc("preview_visit_by_qr", {
    p_qr_token_hash: qrTokenHash,
  });
  const visit = previewData?.[0];
  if (previewError || !visit) {
    return { error: "This visit QR is invalid, closed, or unavailable.", message: null, visit: null, resultingStatus: null };
  }

  if (visit.visit_status === "expected") {
    const { data, error } = await supabase.rpc("check_in_visit_by_qr", {
      p_qr_token_hash: qrTokenHash,
    });
    if (error || !data?.[0]) {
      return { error: "This visit could not be checked in. It may already be inside or closed.", message: null, visit, resultingStatus: null };
    }
    revalidatePath("/app/security/inside");
    return { error: null, message: `${data[0].checked_in_visit_reference} verified and checked in.`, visit, resultingStatus: "inside" };
  }

  const { data, error } = await supabase.rpc("check_out_visit", {
    p_visit_id: visit.visit_id,
  });
  if (error || !data?.[0]) {
    return { error: "This visit could not be checked out. It may already be closed.", message: null, visit, resultingStatus: null };
  }
  revalidatePath("/app/security/inside");
  return { error: null, message: `${data[0].checked_out_visit_reference} verified and checked out.`, visit, resultingStatus: "left" };
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
  if (!/^(?:\d{4}|\d{6})$/.test(code)) return { error: "Enter the current four-digit host code.", hostMembershipId: null, hostName: null, attemptId: null };
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
    companionCount: Number(formData.get("companionCount") ?? 0),
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
    p_full_name: details.fullName.trim(), p_group_size: totalGroupSize(details.companionCount),
    p_host_code_attempt_id: attemptId ?? undefined, p_host_membership_id: hostId,
    p_phone: noPhone ? "" : details.phone.trim(), p_phone_not_provided: noPhone,
    p_purpose: details.purpose.trim(),
  });
  if (error || !data?.[0]) return { error: "The visitor could not be registered. Check the host and organization entry mode.", message: null };
  revalidatePath("/app/security/inside");
  return { error: null, message: `${data[0].registered_visit_reference} registered and checked in.` };
}

export async function updateVisitCompanions(_state: GateResult, formData: FormData): Promise<GateResult> {
  const visitId = formData.get("visitId")?.toString() ?? "";
  const companionCount = Number(formData.get("companionCount"));
  if (!visitId || !Number.isInteger(companionCount) || companionCount < 0 || companionCount > 99) {
    return { error: "Enter a companion count between 0 and 99.", message: null };
  }
  const { supabase } = await securityClient();
  const { data, error } = await supabase.rpc("update_visit_companions", {
    p_companion_count: companionCount,
    p_visit_id: visitId,
  });
  if (error || data === null) {
    console.error("Visit companion update failed", {
      code: error?.code,
      message: error?.message,
    });
    return { error: "The companion count could not be updated.", message: null };
  }
  revalidatePath("/app/security/inside");
  return { error: null, message: `Companions updated to ${companionCount}.` };
}

export async function verifyHostLocation(_state: LocationVerificationState, formData: FormData): Promise<LocationVerificationState> {
  const targetId = formData.get("targetId")?.toString() ?? "";
  const targetType = formData.get("targetType")?.toString() ?? "";
  const address = formData.get("address")?.toString().trim() ?? "";
  const occupancyType = formData.get("occupancyType")?.toString() ?? "";
  if (!targetId || (targetType !== "request" && targetType !== "membership") || address.length < 5 || address.length > 300) return { error: "Enter the host's full house or unit address.", message: null };
  if (occupancyType !== "landlord" && occupancyType !== "tenant") return { error: "Choose landlord or tenant.", message: null };
  const { supabase } = await securityClient();
  const { data, error } = await supabase.rpc("verify_pending_host_location", {
    p_address: address,
    p_occupancy_type: occupancyType,
    p_target_id: targetId,
    p_target_type: targetType,
  });
  if (error || !data) {
    console.error("Host location verification failed", { code: error?.code, message: error?.message });
    return { error: "The host location could not be verified.", message: null };
  }
  revalidatePath("/app/security/locations");
  revalidatePath("/app/admin/invitations");
  return { error: null, message: "Location verified. The administrator can now review this host." };
}
