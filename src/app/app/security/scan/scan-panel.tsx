"use client";

import { Scanner } from "@yudiel/react-qr-scanner";
import { useState, useTransition } from "react";
import { checkInByQr, checkOutVisit, previewQr, type QrPreview } from "../actions";

const emptyPreview: QrPreview = { error: null, visit: null, payload: null };

export function ScanPanel() {
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [manualValue, setManualValue] = useState("");
  const [preview, setPreview] = useState(emptyPreview);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const inspect = (value: string) => { setCameraEnabled(false); setMessage(null); startTransition(async () => setPreview(await previewQr(value))); };
  const checkIn = () => { if (preview.payload) startTransition(async () => { const result = await checkInByQr(preview.payload!); setMessage(result.error ?? result.message); if (!result.error) setPreview(emptyPreview); }); };
  const checkOut = () => { if (preview.visit) startTransition(async () => { const result = await checkOutVisit(preview.visit!.visit_id); setMessage(result.error ?? result.message); if (!result.error) setPreview(emptyPreview); }); };

  return <div className="grid gap-6"><section className="card"><p className="eyebrow">QR scanner</p><h1 className="title">Find a visit</h1><p className="copy">Use the camera or paste the QR value manually.</p>{cameraEnabled ? <div className="mt-6 overflow-hidden rounded-xl"><Scanner onScan={(codes) => { const value = codes[0]?.rawValue; if (value) inspect(value); }} onError={() => setMessage("Camera access failed. Use the manual fallback below.")} /></div> : <button className="button-primary mt-6" type="button" onClick={() => setCameraEnabled(true)}>Start camera</button>}<form className="mt-6" onSubmit={(event) => { event.preventDefault(); inspect(manualValue); }}><label className="font-semibold">Manual QR value<input className="field font-normal" value={manualValue} onChange={(event) => setManualValue(event.target.value)} autoComplete="off" /></label><button className="button-secondary mt-3" disabled={pending}>Check QR</button></form></section>{preview.error ? <p className="alert-error" role="alert">{preview.error}</p> : null}{message ? <p className={message.includes("checked") ? "rounded-lg bg-emerald-50 p-4 text-emerald-900" : "alert-error"} role="status">{message}</p> : null}{preview.visit ? <section className="card"><p className="eyebrow">Confirm visitor</p><h2 className="mt-2 text-2xl font-semibold">{preview.visit.visitor_name}</h2><dl className="mt-5 grid gap-3 sm:grid-cols-2"><div><dt className="text-sm text-slate-500">Visit ID</dt><dd className="font-semibold">{preview.visit.visit_reference}</dd></div><div><dt className="text-sm text-slate-500">Host</dt><dd>{preview.visit.host_name}</dd></div><div><dt className="text-sm text-slate-500">Purpose</dt><dd>{preview.visit.purpose}</dd></div><div><dt className="text-sm text-slate-500">People entering</dt><dd>{preview.visit.group_size}</dd></div><div><dt className="text-sm text-slate-500">Status</dt><dd className="uppercase">{preview.visit.visit_status}</dd></div></dl>{preview.visit.visit_status === "expected" ? <button className="button-primary mt-6" disabled={pending} onClick={checkIn}>Confirm check-in</button> : <button className="button-primary mt-6" disabled={pending} onClick={checkOut}>Confirm check-out</button>}</section> : null}</div>;
}
