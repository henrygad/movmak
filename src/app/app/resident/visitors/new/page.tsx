import { randomUUID } from "node:crypto";
import { requireActiveMembership } from "@/lib/auth/dal";
import { ResidentVisitForm } from "./visit-form";
export default async function NewResidentVisitPage() { await requireActiveMembership(["host"]); return <main className="content-shell"><section className="card"><p className="eyebrow">Resident visitor</p><h1 className="title">Create an expected visit</h1><p className="copy">Register the visitor yourself, then send them the QR for Security to scan at arrival.</p></section><ResidentVisitForm idempotencyKey={randomUUID()} /></main>; }
