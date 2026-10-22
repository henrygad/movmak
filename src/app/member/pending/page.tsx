import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/dal";
import { accountTypeFromMetadata } from "@/lib/auth/signup-flow";

export default async function PendingMemberPage({ searchParams }: { searchParams: Promise<{ role?: string }> }) {
  const context = await requireUser();
  if (context.kind === "active") redirect("/app");
  if (context.kind === "inactive") redirect("/access-inactive");
  const metadataRole = accountTypeFromMetadata(context.user.user_metadata);
  const requestedRole = (await searchParams).role;
  const role = requestedRole === "security" || requestedRole === "host" ? requestedRole : metadataRole;
  if (role !== "host" && role !== "security") redirect("/onboarding");
  redirect(`/app/${role}`);
}
