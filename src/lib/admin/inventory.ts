export type InventoryStatus = "expected" | "inside" | "left";

export function matchesInventoryQuery(
  visit: { visitReference: string; visitorName: string; hostName: string; purpose: string },
  query: string | undefined,
) {
  const normalized = query?.trim().toLowerCase();
  if (!normalized) return true;
  return [visit.visitReference, visit.visitorName, visit.hostName, visit.purpose]
    .some((value) => value.toLowerCase().includes(normalized));
}

export function summarizeHeadcount(visits: readonly { status: InventoryStatus; groupSize: number }[]) {
  const totals: Record<InventoryStatus, number> = { expected: 0, inside: 0, left: 0 };
  visits.forEach((visit) => { totals[visit.status] += visit.groupSize; });
  return totals;
}
