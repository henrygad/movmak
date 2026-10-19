"use client";

export default function RegistrationError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="page-shell"><section className="card w-full max-w-xl"><p className="eyebrow">Visitor registration</p><h1 className="title">Registration is temporarily unavailable</h1><p className="copy">No visit was created. Ask your host for a fresh invitation if this continues.</p><button className="button-primary mt-6" type="button" onClick={reset}>Try again</button></section></main>;
}
