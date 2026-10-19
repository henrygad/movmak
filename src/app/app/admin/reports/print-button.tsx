"use client";

export function PrintButton() {
  return <button className="button-primary print:hidden" type="button" onClick={() => window.print()}>Print report</button>;
}
