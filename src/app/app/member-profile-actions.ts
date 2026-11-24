"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/dal";
import { accountTypeFromMetadata } from "@/lib/auth/signup-flow";
import { createClient } from "@/lib/supabase/server";
import type { DatabaseWithPendingOnboarding } from "@/types/pending-database.types";

export type MemberProfileState = { error: string | null; message: string | null };

const allowedPhotoTypes = new Set(["image/png", "image/jpeg", "image/webp"]);

export async function updateMemberProfile(_state: MemberProfileState, formData: FormData): Promise<MemberProfileState> {
  const context = await requireUser();
  if (context.kind === "inactive") return { error: "This account is not active.", message: null };
  const role = context.kind === "active"
    ? context.membership.role
    : accountTypeFromMetadata(context.user.user_metadata);
  if (role !== "host" && role !== "security") return { error: "This profile cannot be updated here.", message: null };

  const fullName = formData.get("fullName")?.toString().trim() ?? "";
  const areaZone = formData.get("areaZone")?.toString().trim() ?? "";
  const houseNumber = formData.get("houseNumber")?.toString().trim() ?? "";
  const flatUnit = formData.get("flatUnit")?.toString().trim() ?? "";
  const residentStatus = formData.get("residentStatus")?.toString() ?? "";
  const occupancyType = formData.get("occupancyType")?.toString() ?? "";
  if (fullName.length < 2 || fullName.length > 160) return { error: "Enter your full name.", message: null };
  if (role === "host" && (areaZone.length < 2 || areaZone.length > 120)) return { error: "Enter your area or zone.", message: null };
  if (role === "host" && (houseNumber.length < 1 || houseNumber.length > 80)) return { error: "Enter your house number or name.", message: null };
  if (role === "host" && flatUnit.length > 80) return { error: "The flat or unit is too long.", message: null };
  if (role === "host" && residentStatus === "household_member") return { error: "Household members must use the family invitation sent by the primary resident.", message: null };
  if (role === "host" && residentStatus !== "primary") return { error: "Choose a valid resident status.", message: null };
  if (role === "host" && occupancyType !== "landlord" && occupancyType !== "tenant") return { error: "Choose landlord or tenant.", message: null };

  const supabase = await createClient<DatabaseWithPendingOnboarding>();
  let profilePhotoPath: string | undefined;
  const photo = formData.get("profilePhoto");
  if (role === "security" && photo instanceof File && photo.size > 0) {
    if (!allowedPhotoTypes.has(photo.type)) return { error: "Use a PNG, JPEG, or WebP profile photo.", message: null };
    if (photo.size >= 2 * 1024 * 1024) return { error: "The profile photo must be smaller than 2 MB.", message: null };
    profilePhotoPath = `${context.user.id}/profile`;
    const { error: uploadError } = await supabase.storage.from("member-profile-photos")
      .upload(profilePhotoPath, photo, { cacheControl: "3600", contentType: photo.type, upsert: true });
    if (uploadError) {
      console.error("Member profile photo upload failed", { message: uploadError.message, name: uploadError.name });
      return { error: "The profile photo could not be uploaded.", message: null };
    }
  }

  const result = role === "host"
    ? await supabase.rpc("update_my_primary_resident_profile", {
      p_full_name: fullName,
      p_property_status: occupancyType,
      p_area_zone: areaZone,
      p_house_number: houseNumber,
      p_flat_unit: flatUnit || null,
    })
    : await supabase.from("user_profiles")
      .update({ full_name: fullName, ...(profilePhotoPath ? { profile_photo_path: profilePhotoPath } : {}) })
      .eq("user_id", context.user.id)
      .select("user_id")
      .maybeSingle();
  if (result.error || !result.data) {
    console.error("Member profile update failed", { code: result.error?.code, message: result.error?.message });
    return { error: "Your profile could not be saved.", message: null };
  }

  revalidatePath(role === "host" ? "/app/resident" : "/app/security");
  return {
    error: null,
    message: role === "host"
      ? "Profile saved. Security must verify your location before approval."
      : "Profile saved.",
  };
}
