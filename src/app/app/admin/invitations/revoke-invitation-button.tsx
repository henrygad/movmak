"use client";

import { useState, useTransition } from "react";
import { revokeInvitation } from "./actions";

export function RevokeInvitationButton({ invitationId }: { invitationId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return <div><button className="button-secondary" disabled={pending} onClick={() => startTransition(async () => { const result = await revokeInvitation(invitationId); setError(result.error); })}>{pending ? "Revoking…" : "Revoke"}</button>{error ? <p className="mt-2 text-xs text-red-800" role="alert">{error}</p> : null}</div>;
}
