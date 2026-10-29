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
  const phone = formData.get("phone")?.toString().trim() ?? "";
  const address = formData.get("address")?.toString().trim() ?? "";
  const occupancyType = formData.get("occupancyType")?.toString() ?? "";
  if (fullName.length < 2 || fullName.length > 160) return { error: "Enter your full name.", message: null };
  if (phone.length < 3 || phone.length > 40) return { error: "Enter a valid phone number.", message: null };
  if (role === "host" && (address.length < 5 || address.length > 300)) return { error: "Enter your full house or unit address.", message: null };
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

  const update = role === "host"
    ? { full_name: fullName, phone, address, occupancy_type: occupancyType }
    : { full_name: fullName, phone, ...(profilePhotoPath ? { profile_photo_path: profilePhotoPath } : {}) };
  const { data, error } = await supabase.from("user_profiles")
    .update(update)
    .eq("user_id", context.user.id)
    .select("user_id")
    .maybeSingle();
  if (error || !data) {
    console.error("Member profile update failed", { code: error?.code, message: error?.message });
    return { error: "Your profile could not be saved.", message: null };
  }

  revalidatePath(role === "host" ? "/app/host" : "/app/security");
  return {
    error: null,
    message: role === "host"
      ? "Profile saved. Security must verify your location before approval."
      : "Profile saved.",
  };
}
