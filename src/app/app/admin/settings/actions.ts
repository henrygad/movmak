"use server";

import { revalidatePath } from "next/cache";
import { requireActiveMembership } from "@/lib/auth/dal";
import { normalizeOrganizationWebsite } from "@/lib/organizations/website";
import { createClient } from "@/lib/supabase/server";
import type { DatabaseWithPendingOnboarding } from "@/types/pending-database.types";

export type OrganizationSettingsState = { error: string | null; message: string | null };
const allowedLogoTypes = new Map([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/webp", "webp"],
]);

export async function updateOrganizationSettings(
  _state: OrganizationSettingsState,
  formData: FormData,
): Promise<OrganizationSettingsState> {
  const context = await requireActiveMembership(["admin"]);
  const website = normalizeOrganizationWebsite(formData.get("website")?.toString() ?? "");
  if (!website) return { error: "Enter a valid organization website, such as example.com.", message: null };

  const supabase = await createClient<DatabaseWithPendingOnboarding>();
  const { data: organization, error: organizationError } = await supabase.from("organizations")
    .select("logo_url").eq("id", context.organization.id).single();
  if (organizationError) return { error: "Organization settings could not be loaded.", message: null };

  const logo = formData.get("logo");
  let logoUrl = organization.logo_url;
  if (logo instanceof File && logo.size > 0) {
    const extension = allowedLogoTypes.get(logo.type);
    if (!extension) return { error: "Use a PNG, JPEG, or WebP logo.", message: null };
    if (logo.size >= 2 * 1024 * 1024) return { error: "The logo must be smaller than 2 MB.", message: null };
    const objectPath = `${context.organization.id}/logo`;
    const { error: uploadError } = await supabase.storage.from("organization-logos")
      .upload(objectPath, logo, { cacheControl: "3600", contentType: logo.type, upsert: true });
    if (uploadError) {
      console.error("Organization logo upload failed", {
        message: uploadError.message,
        name: uploadError.name,
      });
      return { error: "The logo could not be uploaded. Check its format and try again.", message: null };
    }
    logoUrl = supabase.storage.from("organization-logos").getPublicUrl(objectPath).data.publicUrl;
  }

  const { error } = await supabase.rpc("update_organization_settings", {
    p_logo_url: logoUrl,
    p_website_url: website,
  });
  if (error) return { error: "Organization settings could not be saved.", message: null };
  revalidatePath("/app", "layout");
  return { error: null, message: "Organization settings updated." };
}

