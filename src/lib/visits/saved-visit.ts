import "server-only";

import { cookies } from "next/headers";
import QRCode from "qrcode";
import { hashInvitationToken, isPlausibleInvitationToken } from "@/lib/auth/invitations";
import { createServiceClient } from "@/lib/supabase/service";
import { hashVisitQrToken, parseVisitQrPayload } from "@/lib/visits/credentials";
import { unsealVisitQr, visitQrCookieName } from "@/lib/visits/visit-qr-cookie";

export async function readSavedVisitQr(invitationToken: string) {
  if (!isPlausibleInvitationToken(invitationToken)) return null;
  const raw = (await cookies()).get(visitQrCookieName)?.value;
  const serverSecret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!raw || !serverSecret) return null;
  const stored = unsealVisitQr(raw, serverSecret);
  if (!stored || stored.invitationHash !== hashInvitationToken(invitationToken)) return null;
  const qrToken = parseVisitQrPayload(stored.qrPayload);
  if (!qrToken) return null;

  const service = createServiceClient();
  const { data: qr, error: qrError } = await service.from("visit_qr_credentials")
    .select("visit_id, expires_at")
    .eq("token_hash", hashVisitQrToken(qrToken))
    .is("revoked_at", null).maybeSingle();
  if (qrError) throw new Error("Saved visit could not be checked.");
  if (!qr || (qr.expires_at && Date.parse(qr.expires_at) <= Date.now())) return null;
  const { data: visit, error: visitError } = await service.from("visits")
    .select("visit_reference, status, invitation_credential_id, organization_id")
    .eq("id", qr.visit_id).maybeSingle();
  if (visitError) throw new Error("Saved visit could not be checked.");
  if (!visit || visit.status === "left" || visit.visit_reference !== stored.visitReference || !visit.invitation_credential_id) return null;
  const { data: invitation, error: invitationError } = await service.from("invitation_credentials")
    .select("token_hash").eq("id", visit.invitation_credential_id).maybeSingle();
  if (invitationError) throw new Error("Saved visit could not be checked.");
  if (!invitation || invitation.token_hash !== stored.invitationHash) return null;

  let organization: { name: string; logoUrl: string | null } | null = null;
  try {
    const { data, error } = await service.from("organizations")
      .select("name, logo_url").eq("id", visit.organization_id).maybeSingle();
    if (!error && data) organization = {
      name: data.name,
      logoUrl: data.logo_url?.startsWith("https://") ? data.logo_url : null,
    };
  } catch {
    // Organization branding is optional; keep the already-verified QR available.
  }

  return {
    visitReference: stored.visitReference,
    qrDataUrl: await QRCode.toDataURL(stored.qrPayload, { errorCorrectionLevel: "M", margin: 2, width: 640 }),
    organization,
  };
}
