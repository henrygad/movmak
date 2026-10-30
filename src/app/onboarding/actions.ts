"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAccessContext } from "@/lib/auth/dal";
import type { DatabaseWithPendingOnboarding } from "@/types/pending-database.types";
import { validateOrganizationName } from "@/lib/auth/access";
import { accountTypeFromMetadata } from "@/lib/auth/signup-flow";
import { normalizeOrganizationWebsite } from "@/lib/organizations/website";

export type OnboardingState = { error: string | null };
const allowedLogoTypes = new Set(["image/png", "image/jpeg", "image/webp"]);

export async function createOrganization(_previousState: OnboardingState, formData: FormData): Promise<OnboardingState> {
  const context = await getAccessContext();
  if (context.kind === "unauthenticated") redirect("/login");
  if (context.kind === "active") redirect("/app");
  if (context.kind === "inactive") redirect("/access-inactive");
  const accountType = accountTypeFromMetadata(context.user.user_metadata);
  if (accountType === "host" || accountType === "security") redirect(`/app/${accountType}`);

  const name = formData.get("name")?.toString().trim() ?? "";
  const website = normalizeOrganizationWebsite(formData.get("website")?.toString() ?? "");
  const validationError = validateOrganizationName(name);
  if (validationError) return { error: validationError };
  if (!website) return { error: "Enter a valid organization website, such as example.com." };

  const logo = formData.get("logo");
  if (logo instanceof File && logo.size > 0) {
    if (!allowedLogoTypes.has(logo.type)) return { error: "Use a PNG, JPEG, or WebP logo." };
    if (logo.size >= 2 * 1024 * 1024) return { error: "The logo must be smaller than 2 MB." };
  }

  const supabase = await createClient<DatabaseWithPendingOnboarding>();
  const { data, error } = await supabase.rpc("create_organization_with_admin", {
    p_name: name,
    p_website_url: website,
    p_timezone: "Africa/Lagos",
  });
  if (error) {
    if (error.code === "PGRST202") return { error: "Organization onboarding is awaiting database approval." };
    if (error.code === "23505") return { error: "That organization website is already in use." };
    return { error: "We could not create the organization. Please try again." };
  }

  const organizationId = data?.[0]?.organization_id;
  if (organizationId && logo instanceof File && logo.size > 0) {
    const objectPath = `${organizationId}/logo`;
    const { error: uploadError } = await supabase.storage.from("organization-logos")
      .upload(objectPath, logo, { cacheControl: "3600", contentType: logo.type, upsert: true });
    if (uploadError) {
      console.error("Onboarding logo upload failed", { message: uploadError.message, name: uploadError.name });
      redirect("/app/admin/settings?logo=upload_failed");
    }
    const logoUrl = supabase.storage.from("organization-logos").getPublicUrl(objectPath).data.publicUrl;
    const { error: settingsError } = await supabase.rpc("update_organization_settings", {
      p_logo_url: logoUrl,
      p_website_url: website,
    });
    if (settingsError) {
      console.error("Onboarding logo settings update failed", { code: settingsError.code, message: settingsError.message });
      redirect("/app/admin/settings?logo=update_failed");
    }
  }

  redirect("/app");
}
