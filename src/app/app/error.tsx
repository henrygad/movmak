"use client";

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="content-shell"><section className="card"><p className="eyebrow">Something went wrong</p><h1 className="title">We could not load this workspace</h1><p className="copy">Your data was not changed. Try the request again. If the problem continues, contact your organization administrator.</p><button className="button-primary mt-6" type="button" onClick={reset}>Try again</button></section></main>;
}
