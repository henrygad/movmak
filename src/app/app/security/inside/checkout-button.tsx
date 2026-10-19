"use client";

import { useState, useTransition } from "react";
import { checkOutVisit } from "../actions";

export function CheckoutButton({ visitId }: { visitId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return <div><button className="button-secondary" disabled={pending} onClick={() => startTransition(async () => { const result = await checkOutVisit(visitId); setError(result.error); })}>{pending ? "Checking out…" : "Check out"}</button>{error ? <p className="mt-2 text-sm text-red-800" role="alert">{error}</p> : null}</div>;
}
