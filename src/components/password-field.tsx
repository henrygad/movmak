"use client";

import { useState } from "react";

export function PasswordField({
  id = "password",
  name = "password",
  autoComplete,
  minLength,
}: {
  id?: string;
  name?: string;
  autoComplete: "current-password" | "new-password";
  minLength: number;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        className="field pr-12"
        id={id}
        name={name}
        type={visible ? "text" : "password"}
        autoComplete={autoComplete}
        minLength={minLength}
        required
      />
      <button
        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-emerald-700"
        type="button"
        aria-label={visible ? "Hide characters" : "Show characters"}
        aria-pressed={visible}
        onClick={() => setVisible((current) => !current)}
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2">
          {visible ? <><path d="M3 3l18 18" /><path d="M10.6 10.7a2 2 0 002.7 2.7M9.9 4.2A10.8 10.8 0 0112 4c5 0 9 4 10 8a12.8 12.8 0 01-2 3.9M6.2 6.2C4 7.6 2.6 9.7 2 12c1 4 5 8 10 8 1.4 0 2.7-.3 3.8-.8" /></> : <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>}
        </svg>
      </button>
    </div>
  );
}
