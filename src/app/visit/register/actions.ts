"use server";

import QRCode from "qrcode";
import { hashInvitationToken, isPlausibleInvitationToken } from "@/lib/auth/invitations";
import { createServiceClient } from "@/lib/supabase/service";
import { createVisitQrCredential } from "@/lib/visits/credentials";
import { readSavedVisitQr } from "@/lib/visits/saved-visit";
import { phoneNumbersMatch, totalGroupSize, validateVisitorDetails } from "@/lib/visits/validation";
import { sealVisitQr, visitQrCookieName } from "@/lib/visits/visit-qr-cookie";
import type { Database } from "@/types/database.types";
import { cookies } from "next/headers";

export type RegistrationState = {
  error: string | null;
  visitReference: string | null;
  qrDataUrl: string | null;
  organization: { name: string; logoUrl: string | null } | null;
};

const emptyRegistrationState: RegistrationState = { error: null, visitReference: null, qrDataUrl: null, organization: null };

export async function registerVisitor(_state: RegistrationState, formData: FormData): Promise<RegistrationState> {
  const invitationToken = formData.get("token")?.toString() ?? "";
  if (!isPlausibleInvitationToken(invitationToken)) return { ...emptyRegistrationState, error: "This invitation is invalid or unavailable." };
  try {
    const saved = await readSavedVisitQr(invitationToken);
    if (saved) return { error: null, visitReference: saved.visitReference, qrDataUrl: saved.qrDataUrl, organization: saved.organization };
  } catch {
    return { ...emptyRegistrationState, error: "Your previous registration could not be checked. Please try again." };
  }

  const details = {
    fullName: formData.get("fullName")?.toString() ?? "",
    phone: formData.get("phone")?.toString() ?? "",
    purpose: formData.get("purpose")?.toString() ?? "",
    companionCount: Number(formData.get("companionCount") ?? 0),
  };
  const validationError = validateVisitorDetails(details);
  if (validationError) return { ...emptyRegistrationState, error: validationError };
  const phoneConfirmation = formData.get("phoneConfirmation")?.toString() ?? "";
  if (!phoneNumbersMatch(details.phone, phoneConfirmation)) {
    return { ...emptyRegistrationState, error: "The phone numbers do not match." };
  }

  const qr = createVisitQrCredential();
  let qrDataUrl: string;
  try {
    qrDataUrl = await QRCode.toDataURL(qr.payload, { errorCorrectionLevel: "M", margin: 2, width: 640 });
  } catch {
    return { ...emptyRegistrationState, error: "Your QR could not be prepared. Please try again." };
  }
  let visitReference: string;
  let organization: RegistrationState["organization"] = null;
  try {
    const supabase = createServiceClient<Database>();
    const { data, error } = await supabase.rpc("register_invited_visit", {
      p_full_name: details.fullName.trim(),
      p_group_size: totalGroupSize(details.companionCount),
      p_invitation_token_hash: hashInvitationToken(invitationToken),
      p_phone: details.phone.trim(),
      p_purpose: details.purpose.trim(),
      p_qr_token_hash: qr.tokenHash,
    });
    const visit = data?.[0];
    if (error || !visit) return { ...emptyRegistrationState, error: "This invitation has expired, was already used, or is unavailable." };
    visitReference = visit.registered_visit_reference;
    // The form token is editable. Resolve the displayed organization from the
    // visit that the database actually created, not from the landing page.
    try {
      const { data: registeredVisit } = await supabase.from("visits")
        .select("organization_id").eq("id", visit.registered_visit_id).maybeSingle();
      if (registeredVisit) {
        const { data: registeredOrganization } = await supabase.from("organizations")
          .select("name, logo_url").eq("id", registeredVisit.organization_id).maybeSingle();
        if (registeredOrganization) organization = {
          name: registeredOrganization.name,
          logoUrl: registeredOrganization.logo_url?.startsWith("https://") ? registeredOrganization.logo_url : null,
        };
      }
    } catch {
      // Registration is committed. A missing identity label must not hide the QR.
    }
  } catch {
    return { ...emptyRegistrationState, error: "Registration is temporarily unavailable. Please try again." };
  }

  const serverSecret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (serverSecret) {
    try {
      (await cookies()).set(visitQrCookieName, sealVisitQr({
        invitationHash: hashInvitationToken(invitationToken),
        qrPayload: qr.payload,
        visitReference,
      }, serverSecret), {
        httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax",
        path: "/visit/register", maxAge: 7 * 24 * 60 * 60,
      });
    } catch {
      // Registration already committed. Return the QR so the visitor can save it.
    }
  }
  return { error: null, visitReference, qrDataUrl, organization };
}
