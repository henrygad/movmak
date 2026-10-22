"use client";

import type { IScannerError } from "@yudiel/react-qr-scanner";
import dynamic from "next/dynamic";
import { useRef, useState, useTransition } from "react";
import { processQr, type QrProcessResult } from "../actions";
import { cameraErrorMessage } from "@/lib/visits/camera-error";

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
    setCameraEnabled(false);
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
            <button className="button-secondary mt-3" type="button" onClick={() => setCameraEnabled(false)}>
              Close camera
            </button>
          </div>
        ) : (
          <button className="button-primary mt-6" type="button" disabled={pending} onClick={startCamera}>
            Start camera
          </button>
        )}

        <p className="mt-3 text-sm text-slate-500">
          Camera access works on HTTPS or <span className="font-medium">http://localhost:3000</span>. Allow camera access when your browser asks.
        </p>

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
            <div><dt className="text-sm text-slate-500">Purpose</dt><dd>{result.visit.purpose}</dd></div>
            <div><dt className="text-sm text-slate-500">People entering</dt><dd>{result.visit.group_size}</dd></div>
            <div><dt className="text-sm text-slate-500">Status</dt><dd className="uppercase">{result.resultingStatus ?? result.visit.visit_status}</dd></div>
          </dl>
        </section>
      ) : null}
    </div>
  );
}
