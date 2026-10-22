"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAccessContext } from "@/lib/auth/dal";
import type { DatabaseWithPendingOnboarding } from "@/types/pending-database.types";
import { validateOrganizationInput } from "@/lib/auth/access";
import { accountTypeFromMetadata } from "@/lib/auth/signup-flow";

export type OnboardingState = { error: string | null };

export async function createOrganization(
  _previousState: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const context = await getAccessContext();
  if (context.kind === "unauthenticated") redirect("/login");
  if (context.kind === "active") redirect("/app");
  if (context.kind === "inactive") redirect("/access-inactive");
  const accountType = accountTypeFromMetadata(context.user.user_metadata);
  if (accountType === "host" || accountType === "security") redirect(`/app/${accountType}`);

  const name = formData.get("name")?.toString().trim() ?? "";
  const slug = formData.get("slug")?.toString().trim().toLowerCase() ?? "";
  const validationError = validateOrganizationInput(name, slug);
  if (validationError) return { error: validationError };

  const supabase = await createClient<DatabaseWithPendingOnboarding>();
  const { error } = await supabase.rpc("create_organization_with_admin", {
    p_name: name,
    p_slug: slug,
    p_timezone: "Africa/Lagos",
  });

  if (error) {
    if (error.code === "PGRST202") {
      return { error: "Organization onboarding is awaiting database approval." };
    }
    if (error.code === "23505") {
      return { error: "That organization URL name is already in use." };
    }
    return { error: "We could not create the organization. Please try again." };
  }

  redirect("/app");
}
