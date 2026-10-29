"use client";

import type { IScannerError } from "@yudiel/react-qr-scanner";
import dynamic from "next/dynamic";
import { useRef, useState, useTransition } from "react";
import { processQr, type QrProcessResult } from "../actions";
import { cameraErrorMessage } from "@/lib/visits/camera-error";
import { CompanionCountForm } from "../companion-count-form";

const Scanner = dynamic(
  () => import("@yudiel/react-qr-scanner").then((module) => module.Scanner),
  {
    ssr: false,
    loading: () => <p className="p-6 text-center text-sm text-white">Starting camera…</p>,
  },
);

const emptyResult: QrProcessResult = {
  error: null,
  message: null,
  visit: null,
  resultingStatus: null,
};

export function ScanPanel() {
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [cameraAttempt, setCameraAttempt] = useState(0);
  const [manualValue, setManualValue] = useState("");
  const [result, setResult] = useState(emptyResult);
  const [keepCameraReady, setKeepCameraReady] = useState(true);
  const [awaitingNextScan, setAwaitingNextScan] = useState(false);
  const [pending, startTransition] = useTransition();
  const scanLocked = useRef(false);

  const startCamera = () => {
    if (!window.isSecureContext) {
      setResult({ ...emptyResult, error: cameraErrorMessage("insecure-context") });
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setResult({ ...emptyResult, error: cameraErrorMessage("unsupported") });
      return;
    }

    setResult(emptyResult);
    setAwaitingNextScan(false);
    setCameraAttempt((attempt) => attempt + 1);
    setCameraEnabled(true);
  };

  const handleCameraError = (error: IScannerError) => {
    setCameraEnabled(false);
    setResult({ ...emptyResult, error: cameraErrorMessage(error.kind) });
  };

  const inspect = (value: string) => {
    if (scanLocked.current) return;
    scanLocked.current = true;
    if (!keepCameraReady) setCameraEnabled(false);
    else setAwaitingNextScan(true);
    setResult(emptyResult);
    startTransition(async () => {
      try {
        setResult(await processQr(value));
      } finally {
        scanLocked.current = false;
      }
    });
  };

  return (
    <div className="grid gap-6">
      <section className="card">
        <p className="eyebrow">QR scanner</p>
        <h1 className="title">Scan to check in or out</h1>
        <p className="copy">
          A valid expected visit is checked in immediately. Scanning the same QR while the visitor is inside checks them out.
        </p>

        {cameraEnabled ? (
          <div className="mt-6">
            <div className="overflow-hidden rounded-xl bg-slate-950">
              <Scanner
                key={cameraAttempt}
                paused={pending || awaitingNextScan}
                allowMultiple
                scanDelay={1200}
                formats={["qr_code"]}
                constraints={{ facingMode: { ideal: "environment" } }}
                components={{ finder: true }}
                styles={{
                  container: { minHeight: "18rem" },
                  video: { minHeight: "18rem", objectFit: "cover" },
                }}
                onScan={(codes) => {
                  const value = codes[0]?.rawValue;
                  if (value) inspect(value);
                }}
                onError={handleCameraError}
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-3">
              {awaitingNextScan ? <button className="button-primary" type="button" disabled={pending} onClick={() => { setResult(emptyResult); setAwaitingNextScan(false); }}>Scan next QR</button> : null}
              <button className="button-secondary" type="button" onClick={() => setCameraEnabled(false)}>Close camera</button>
            </div>
          </div>
        ) : (
          <button className="button-primary mt-6" type="button" disabled={pending} onClick={startCamera}>
            Start camera
          </button>
        )}

        <p className="mt-3 text-sm text-slate-500">
          Camera access works on HTTPS or <span className="font-medium">http://localhost:3000</span>. Allow camera access when your browser asks.
        </p>
        <label className="mt-4 flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-800">
          <input type="checkbox" checked={keepCameraReady} onChange={(event) => setKeepCameraReady(event.target.checked)} />
          <span>Keep the camera open between visitors<span className="mt-1 block font-normal text-slate-500">Scanning pauses after each result. Select Scan next QR to avoid accidentally processing the same code twice.</span></span>
        </label>

        <form
          className="mt-6"
          onSubmit={(event) => {
            event.preventDefault();
            inspect(manualValue);
          }}
        >
          <label className="font-semibold">
            Manual QR value
            <input
              className="field font-normal"
              value={manualValue}
              onChange={(event) => setManualValue(event.target.value)}
              autoComplete="off"
            />
          </label>
          <button className="button-secondary mt-3" disabled={pending}>
            {pending ? "Verifying and updating…" : "Verify QR"}
          </button>
        </form>
      </section>

      {result.error ? <p className="alert-error" role="alert">{result.error}</p> : null}
      {result.message ? <p className="alert-success" role="status">{result.message}</p> : null}
      {result.visit ? (
        <section className="card">
          <p className="eyebrow">Verified visit</p>
          <h2 className="mt-2 text-2xl font-semibold">{result.visit.visitor_name}</h2>
          <dl className="mt-5 grid gap-3 sm:grid-cols-2">
            <div><dt className="text-sm text-slate-500">Visitor phone</dt><dd>{result.visit.visitor_phone || "Not provided"}</dd></div>
            <div><dt className="text-sm text-slate-500">Visit ID</dt><dd className="font-semibold">{result.visit.visit_reference}</dd></div>
            <div><dt className="text-sm text-slate-500">Host</dt><dd>{result.visit.host_name}</dd></div>
            <div><dt className="text-sm text-slate-500">Host phone</dt><dd>{result.visit.host_phone || "Not provided"}</dd></div>
            <div className="sm:col-span-2"><dt className="text-sm text-slate-500">Host house or unit</dt><dd>{result.visit.host_address || "Not provided"}</dd></div>
            <div><dt className="text-sm text-slate-500">Purpose</dt><dd>{result.visit.purpose}</dd></div>
            <div><dt className="text-sm text-slate-500">Companions</dt><dd>{Math.max(0, result.visit.group_size - 1)} <span className="text-slate-500">({result.visit.group_size} total)</span></dd></div>
            <div><dt className="text-sm text-slate-500">Status</dt><dd className="uppercase">{result.resultingStatus ?? result.visit.visit_status}</dd></div>
          </dl>
          {result.resultingStatus !== "left" ? <CompanionCountForm visitId={result.visit.visit_id} groupSize={result.visit.group_size} /> : null}
        </section>
      ) : null}
    </div>
  );
}
