import type { Database } from "@/types/database.types";

type PublicSchema = Database["public"];
type OrganizationTable = PublicSchema["Tables"]["organizations"];
type ProfileTable = PublicSchema["Tables"]["user_profiles"];
type MembershipTable = PublicSchema["Tables"]["organization_memberships"];

type OrganizationsWithWebsite = {
  Row: OrganizationTable["Row"] & { website_url: string | null; physical_address: string | null };
  Insert: OrganizationTable["Insert"] & { website_url?: string | null; physical_address?: string | null };
  Update: OrganizationTable["Update"] & { website_url?: string | null; physical_address?: string | null };
  Relationships: OrganizationTable["Relationships"];
};

type ProfilesWithAddress = {
  Row: ProfileTable["Row"] & { address: string | null; occupancy_type: string | null; profile_photo_path: string | null; verified_phone_e164: string | null; phone_verified_at: string | null; resident_status: string | null; property_status: string | null; area_zone: string | null; house_number: string | null; flat_unit: string | null };
  Insert: ProfileTable["Insert"] & { address?: string | null; occupancy_type?: string | null; profile_photo_path?: string | null; verified_phone_e164?: string | null; phone_verified_at?: string | null; resident_status?: string | null; property_status?: string | null; area_zone?: string | null; house_number?: string | null; flat_unit?: string | null };
  Update: ProfileTable["Update"] & { address?: string | null; occupancy_type?: string | null; profile_photo_path?: string | null; verified_phone_e164?: string | null; phone_verified_at?: string | null; resident_status?: string | null; property_status?: string | null; area_zone?: string | null; house_number?: string | null; flat_unit?: string | null };
  Relationships: ProfileTable["Relationships"];
};

type MembershipsWithVerification = {
  Row: MembershipTable["Row"] & {
    approved_at: string | null;
    approved_by_membership_id: string | null;
    location_verified_at: string | null;
    location_verified_by_membership_id: string | null;
  };
  Insert: MembershipTable["Insert"] & {
    approved_at?: string | null;
    approved_by_membership_id?: string | null;
    location_verified_at?: string | null;
    location_verified_by_membership_id?: string | null;
  };
  Update: MembershipTable["Update"] & {
    approved_at?: string | null;
    approved_by_membership_id?: string | null;
    location_verified_at?: string | null;
    location_verified_by_membership_id?: string | null;
  };
  Relationships: MembershipTable["Relationships"];
};

type PendingFunctions = Omit<
  PublicSchema["Functions"],
  "create_organization_with_admin" | "preview_visit_by_qr" | "get_currently_inside" |
  "update_organization_settings" | "update_visit_companions"
> & {
  create_organization_with_admin: {
    Args: { p_name: string; p_website_url: string; p_timezone?: string };
    Returns: { membership_id: string; organization_id: string }[];
  };
  create_organization_with_admin_v2: {
    Args: { p_name: string; p_website_url: string; p_physical_address: string; p_timezone?: string };
    Returns: { membership_id: string; organization_id: string }[];
  };
  preview_visit_by_qr: {
    Args: { p_qr_token_hash: string };
    Returns: {
      group_size: number;
      host_address: string | null;
      host_name: string;
      host_phone: string | null;
      purpose: string;
      visit_id: string;
      visit_reference: string;
      visit_status: PublicSchema["Enums"]["visit_status"];
      visitor_name: string;
      visitor_phone: string;
    }[];
  };
  get_currently_inside: {
    Args: never;
    Returns: {
      checked_in_at: string;
      group_size: number;
      host_address: string | null;
      host_name: string;
      host_phone: string | null;
      purpose: string;
      visit_id: string;
      visit_reference: string;
      visitor_name: string;
    }[];
  };
  update_visit_companions: {
    Args: { p_companion_count: number; p_visit_id: string };
    Returns: number;
  };
  update_organization_settings: {
    Args: { p_logo_url: string | null; p_website_url: string };
    Returns: boolean;
  };
  update_organization_settings_v2: {
    Args: { p_logo_url: string | null; p_physical_address: string; p_website_url: string };
    Returns: boolean;
  };
  register_invited_visit_idempotent: {
    Args: {
      p_full_name: string;
      p_group_size: number;
      p_idempotency_key_hash: string;
      p_input_fingerprint: string;
      p_invitation_token_hash: string;
      p_phone: string;
      p_purpose: string;
      p_qr_token_hash: string;
    };
    Returns: {
      registered_visit_id: string;
      registered_visit_reference: string;
      replayed: boolean;
    }[];
  };
  sync_my_verified_phone: { Args: never; Returns: string };
  create_family_invitation: {
    Args: { p_email: string; p_expires_at: string; p_full_name: string; p_token_hash: string };
    Returns: { household_id: string; invitation_id: string }[];
  };
  mark_family_invitation_delivery: {
    Args: { p_invitation_id: string; p_provider_code?: string | null; p_status: string };
    Returns: boolean;
  };
  list_my_family_invitations: {
    Args: never;
    Returns: { invitation_id: string; full_name: string; email: string; status: string; expires_at: string; created_at: string }[];
  };
  revoke_family_invitation: { Args: { p_invitation_id: string }; Returns: boolean };
  accept_family_invitation: { Args: { p_token_hash: string }; Returns: string };
  submit_resident_security_report: { Args: { p_category: string; p_details: string }; Returns: string };
  list_my_security_reports: { Args: never; Returns: { report_id: string; category: string; details: string; status: string; submitted_at: string; updated_at: string }[] };
  list_organization_security_reports: { Args: { p_status?: string | null }; Returns: { report_id: string; resident_name: string; category: string; details: string; status: string; submitted_at: string; updated_at: string }[] };
  update_security_report_status: { Args: { p_report_id: string; p_status: string }; Returns: boolean };
  register_resident_expected_visit: {
    Args: { p_full_name: string; p_phone: string; p_purpose: string; p_qr_token_hash: string; p_idempotency_key_hash: string; p_input_fingerprint: string; p_group_size: number };
    Returns: { registered_visit_id: string; registered_visit_reference: string; replayed: boolean }[];
  };
  register_gate_visit_idempotent: {
    Args: { p_host_membership_id: string; p_full_name: string; p_phone: string; p_phone_not_provided: boolean; p_purpose: string; p_group_size: number; p_host_code_attempt_id?: number; p_idempotency_key_hash: string; p_input_fingerprint: string };
    Returns: { registered_visit_id: string; registered_visit_reference: string; replayed: boolean }[];
  };
  get_authorized_visit_detail: {
    Args: { p_visit_id: string };
    Returns: {
      checked_in_at: string | null; checked_in_by_name: string | null;
      checked_out_at: string | null; checked_out_by_name: string | null;
      entry_method: PublicSchema["Enums"]["visit_entry_method"];
      group_size: number; host_address: string | null; host_name: string;
      host_occupancy_type: string | null; host_phone: string | null;
      purpose: string; registered_at: string; visit_id: string;
      visit_reference: string; visit_status: PublicSchema["Enums"]["visit_status"];
      visitor_name: string; visitor_phone: string | null;
    }[];
  };
  get_pending_member_review_details: {
    Args: never;
    Returns: {
      address: string | null; full_name: string | null; location_verified_at: string | null;
      location_verified_by_name: string | null; occupancy_type: string | null;
      phone: string | null; profile_photo_path: string | null; request_id: string;
    }[];
  };
  list_pending_host_location_verifications: {
    Args: never;
    Returns: {
      address: string | null; full_name: string | null; host_user_id: string;
      location_verified_at: string | null; location_verified_by_name: string | null;
      occupancy_type: string | null; phone: string | null; profile_photo_path: string | null;
      requested_at: string; verification_target_id: string; verification_target_type: string;
    }[];
  };
  list_security_visit_history: {
    Args: { p_status?: PublicSchema["Enums"]["visit_status"] | null };
    Returns: {
      checked_in_at: string | null; checked_out_at: string | null; group_size: number;
      host_address: string | null; host_name: string; host_phone: string | null;
      purpose: string; registered_at: string; visit_id: string; visit_reference: string;
      visit_status: PublicSchema["Enums"]["visit_status"]; visitor_name: string; visitor_phone: string | null;
    }[];
  };
  preview_organization_join_branding: {
    Args: { p_token_hash: string };
    Returns: {
      organization_logo_url: string | null;
      organization_name: string;
      requested_role: PublicSchema["Enums"]["organization_role"];
    }[];
  };
  verify_pending_host_location: {
    Args: { p_address: string; p_occupancy_type: string; p_target_id: string; p_target_type: string };
    Returns: boolean;
  };
};

export type DatabaseWithPendingOnboarding = Omit<Database, "public"> & {
  public: Omit<PublicSchema, "Tables" | "Functions"> & {
    Tables: Omit<PublicSchema["Tables"], "organizations" | "organization_memberships" | "user_profiles"> & {
      organizations: OrganizationsWithWebsite;
      organization_memberships: MembershipsWithVerification;
      user_profiles: ProfilesWithAddress;
    };
    Functions: PendingFunctions;
  };
};
