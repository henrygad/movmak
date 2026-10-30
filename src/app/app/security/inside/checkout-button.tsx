"use client";

import { useState, useTransition } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { checkOutVisit } from "../actions";

export function CheckoutButton({ visitId }: { visitId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  return <div>
    <button className="button-secondary" disabled={pending} onClick={() => setConfirmOpen(true)}>{pending ? "Checking out…" : "Check out"}</button>
    {error ? <p className="mt-2 text-sm text-red-800" role="alert">{error}</p> : null}
    <ConfirmDialog
      open={confirmOpen}
      title="Check this visitor out?"
      description="This records the departure time and permanently closes this visit QR."
      confirmLabel="Check out visitor"
      onClose={() => setConfirmOpen(false)}
      onConfirm={() => {
        setConfirmOpen(false);
        startTransition(async () => {
          const result = await checkOutVisit(visitId);
          setError(result.error);
        });
      }}
    />
  </div>;
}
