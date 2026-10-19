import { requireActiveMembership } from "@/lib/auth/dal";
import { ScanPanel } from "./scan-panel";

export default async function ScanPage() {
  await requireActiveMembership(["security"]);
  return <main className="content-shell"><ScanPanel /></main>;
}
