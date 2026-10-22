import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/dal";
import { accountTypeFromMetadata, workspacePathForRole } from "@/lib/auth/signup-flow";

export default async function AppHome() {
  const context = await requireUser();
  if (context.kind === "inactive") redirect("/access-inactive");
  if (context.kind === "active") redirect(workspacePathForRole(context.membership.role));
  const accountType = accountTypeFromMetadata(context.user.user_metadata);
  redirect(accountType === "host" || accountType === "security" ? workspacePathForRole(accountType) : "/onboarding");
}
