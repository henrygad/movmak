"use server";
import QRCode from "qrcode";
import { requireActiveMembership } from "@/lib/auth/dal";
import { normalizePhoneNumber } from "@/lib/phones/normalize";
import { createIdempotentVisitQrCredential, fingerprintVisitInput, hashIdempotencyKey, idempotencyKeyPattern } from "@/lib/visits/idempotency";
import { totalGroupSize, validateVisitorDetails } from "@/lib/visits/validation";
import { createClient } from "@/lib/supabase/server";
import type { DatabaseWithPendingOnboarding } from "@/types/pending-database.types";
export type ResidentVisitState = { error: string | null; visitReference: string | null; qrDataUrl: string | null };
const empty: ResidentVisitState = { error: null, visitReference: null, qrDataUrl: null };
export async function registerResidentVisit(_state: ResidentVisitState, formData: FormData): Promise<ResidentVisitState> {
  const context = await requireActiveMembership(["host"]);
  const details = { fullName: formData.get("fullName")?.toString() ?? "", phone: formData.get("phone")?.toString() ?? "", purpose: formData.get("purpose")?.toString() ?? "", companionCount: Number(formData.get("companionCount") ?? 0) };
  const validation = validateVisitorDetails(details); if (validation) return { ...empty, error: validation };
  const phone = normalizePhoneNumber(details.phone); if (!phone.ok) return { ...empty, error: phone.error };
  const key = formData.get("idempotencyKey")?.toString() ?? ""; if (!idempotencyKeyPattern.test(key)) return { ...empty, error: "Reload this form and try again." };
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY; if (!secret) return { ...empty, error: "Visit registration is not configured." };
  const qr = createIdempotentVisitQrCredential(secret, `resident:${context.membership.id}`, key);
  const supabase = await createClient<DatabaseWithPendingOnboarding>();
  const { data, error } = await supabase.rpc("register_resident_expected_visit", { p_full_name: details.fullName.trim(), p_phone: phone.value, p_purpose: details.purpose, p_group_size: totalGroupSize(details.companionCount), p_qr_token_hash: qr.tokenHash, p_idempotency_key_hash: hashIdempotencyKey(key), p_input_fingerprint: fingerprintVisitInput({ ...details, phone: phone.value }) });
  const visit = data?.[0]; if (error || !visit) return { ...empty, error: error?.message.includes("different details") ? "This submission was already used with different visitor details." : "The expected visit could not be created." };
  try { return { error: null, visitReference: visit.registered_visit_reference, qrDataUrl: await QRCode.toDataURL(qr.payload, { errorCorrectionLevel: "M", margin: 2, width: 640 }) }; }
  catch { return { ...empty, error: "The visit was saved, but its QR could not be displayed. Retry this same form." }; }
}
