import { RegistrationForm } from "./registration-form";
import { previewVisitorInvitation } from "@/lib/visits/invitation-preview";
import type { Metadata } from "next";
import Image from "next/image";
import { readSavedVisitQr } from "@/lib/visits/saved-visit";

export const metadata: Metadata = { referrer: "no-referrer" };

export default async function VisitorRegistrationPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  let saved: Awaited<ReturnType<typeof readSavedVisitQr>> = null;
  let savedUnavailable = false;
  try {
    saved = await readSavedVisitQr(token);
  } catch {
    savedUnavailable = true;
  }
  if (saved) return <main className="page-shell"><div className="w-full max-w-xl"><RegistrationForm token={token} initialState={{ error: null, visitReference: saved.visitReference, qrDataUrl: saved.qrDataUrl, organization: saved.organization }} /></div></main>;
  if (savedUnavailable) return <main className="page-shell"><div className="w-full max-w-xl"><section className="card"><p className="eyebrow">Visitor registration</p><h1 className="title">Could not check this visit</h1><p className="copy">Your saved QR could not be checked right now. Please try again shortly.</p><a className="button-secondary mt-6 inline-flex" href="">Try again</a></section></div></main>;
  const preview = await previewVisitorInvitation(token);
  return <main className="page-shell"><div className="w-full max-w-xl">
    {preview.kind === "valid" ? <>
      <section className="card mb-4" aria-label="Organization inviting you"><div className="flex items-center gap-3">
        {preview.logoUrl ? <Image unoptimized src={preview.logoUrl} alt={`${preview.organizationName} logo`} width={48} height={48} className="size-12 rounded-xl object-contain" /> : <span aria-hidden="true" className="flex size-12 items-center justify-center rounded-xl bg-emerald-100 text-lg font-black text-emerald-800">{preview.organizationName.charAt(0)}</span>}
        <div><p className="eyebrow">Invited to visit</p><p className="text-lg font-bold text-slate-950">{preview.organizationName}</p>{preview.hostName ? <p className="text-sm text-slate-600">Host: {preview.hostName}</p> : null}</div>
      </div></section>
      <RegistrationForm token={token} />
    </> :
      <section className="card"><p className="eyebrow">Visitor registration</p><h1 className="title">{preview.kind === "invalid" ? "Invitation unavailable" : "Could not check this invitation"}</h1><p className="copy">{preview.kind === "invalid" ? "This link is missing, expired, used, or revoked. Ask your host for a new link." : "Please try again shortly. If the problem continues, ask your host for a new link."}</p>{preview.kind === "unavailable" ? <a className="button-secondary mt-6 inline-flex" href="">Try again</a> : null}</section>}
  </div></main>;
}
