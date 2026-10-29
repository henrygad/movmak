import type { Database } from "@/types/database.types";

type PublicSchema = Database["public"];
type OrganizationTable = PublicSchema["Tables"]["organizations"];
type ProfileTable = PublicSchema["Tables"]["user_profiles"];
type MembershipTable = PublicSchema["Tables"]["organization_memberships"];

type OrganizationsWithWebsite = {
  Row: OrganizationTable["Row"] & { website_url: string | null };
  Insert: OrganizationTable["Insert"] & { website_url?: string | null };
  Update: OrganizationTable["Update"] & { website_url?: string | null };
  Relationships: OrganizationTable["Relationships"];
};

type ProfilesWithAddress = {
  Row: ProfileTable["Row"] & { address: string | null; occupancy_type: string | null; profile_photo_path: string | null };
  Insert: ProfileTable["Insert"] & { address?: string | null; occupancy_type?: string | null; profile_photo_path?: string | null };
  Update: ProfileTable["Update"] & { address?: string | null; occupancy_type?: string | null; profile_photo_path?: string | null };
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
      request_id: string; requested_at: string;
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
  verify_pending_host_location: {
    Args: { p_address: string; p_occupancy_type: string; p_request_id: string };
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
