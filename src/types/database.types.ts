export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      audit_events: {
        Row: {
          action: string
          actor_membership_id: string | null
          actor_type: Database["public"]["Enums"]["audit_actor_type"]
          actor_user_id: string | null
          event_data: Json
          id: number
          occurred_at: string
          organization_id: string
          target_id: string | null
          target_table: string
        }
        Insert: {
          action: string
          actor_membership_id?: string | null
          actor_type: Database["public"]["Enums"]["audit_actor_type"]
          actor_user_id?: string | null
          event_data?: Json
          id?: never
          occurred_at?: string
          organization_id: string
          target_id?: string | null
          target_table: string
        }
        Update: {
          action?: string
          actor_membership_id?: string | null
          actor_type?: Database["public"]["Enums"]["audit_actor_type"]
          actor_user_id?: string | null
          event_data?: Json
          id?: never
          occurred_at?: string
          organization_id?: string
          target_id?: string | null
          target_table?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_events_actor_membership_fk"
            columns: ["actor_membership_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "organization_memberships"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "audit_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      host_code_attempts: {
        Row: {
          attempted_at: string
          attempted_by_membership_id: string
          code_fingerprint: string
          id: number
          matched_code_id: string | null
          organization_id: string
          succeeded: boolean
        }
        Insert: {
          attempted_at?: string
          attempted_by_membership_id: string
          code_fingerprint: string
          id?: never
          matched_code_id?: string | null
          organization_id: string
          succeeded: boolean
        }
        Update: {
          attempted_at?: string
          attempted_by_membership_id?: string
          code_fingerprint?: string
          id?: never
          matched_code_id?: string | null
          organization_id?: string
          succeeded?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "host_code_attempts_actor_fk"
            columns: ["attempted_by_membership_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "organization_memberships"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "host_code_attempts_code_fk"
            columns: ["matched_code_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "host_verification_codes"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "host_code_attempts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      host_verification_codes: {
        Row: {
          code_hash: string
          created_at: string
          created_by_membership_id: string | null
          expires_at: string
          host_membership_id: string
          id: string
          last_used_at: string | null
          organization_id: string
          revoked_at: string | null
          use_count: number
          valid_from: string
        }
        Insert: {
          code_hash: string
          created_at?: string
          created_by_membership_id?: string | null
          expires_at: string
          host_membership_id: string
          id?: string
          last_used_at?: string | null
          organization_id: string
          revoked_at?: string | null
          use_count?: number
          valid_from?: string
        }
        Update: {
          code_hash?: string
          created_at?: string
          created_by_membership_id?: string | null
          expires_at?: string
          host_membership_id?: string
          id?: string
          last_used_at?: string | null
          organization_id?: string
          revoked_at?: string | null
          use_count?: number
          valid_from?: string
        }
        Relationships: [
          {
            foreignKeyName: "host_verification_codes_creator_fk"
            columns: ["created_by_membership_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "organization_memberships"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "host_verification_codes_host_fk"
            columns: ["host_membership_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "organization_memberships"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "host_verification_codes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      invitation_credentials: {
        Row: {
          code_hash: string | null
          consumed_at: string | null
          created_at: string
          created_by_membership_id: string | null
          expires_at: string
          host_membership_id: string
          id: string
          organization_id: string
          revoked_at: string | null
          token_hash: string
          valid_from: string
        }
        Insert: {
          code_hash?: string | null
          consumed_at?: string | null
          created_at?: string
          created_by_membership_id?: string | null
          expires_at: string
          host_membership_id: string
          id?: string
          organization_id: string
          revoked_at?: string | null
          token_hash: string
          valid_from?: string
        }
        Update: {
          code_hash?: string | null
          consumed_at?: string | null
          created_at?: string
          created_by_membership_id?: string | null
          expires_at?: string
          host_membership_id?: string
          id?: string
          organization_id?: string
          revoked_at?: string | null
          token_hash?: string
          valid_from?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitation_credentials_creator_fk"
            columns: ["created_by_membership_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "organization_memberships"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "invitation_credentials_host_fk"
            columns: ["host_membership_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "organization_memberships"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "invitation_credentials_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_memberships: {
        Row: {
          created_at: string
          created_by_user_id: string
          id: string
          organization_id: string
          revoked_at: string | null
          role: Database["public"]["Enums"]["organization_role"]
          status: Database["public"]["Enums"]["membership_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by_user_id: string
          id?: string
          organization_id: string
          revoked_at?: string | null
          role: Database["public"]["Enums"]["organization_role"]
          status?: Database["public"]["Enums"]["membership_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by_user_id?: string
          id?: string
          organization_id?: string
          revoked_at?: string | null
          role?: Database["public"]["Enums"]["organization_role"]
          status?: Database["public"]["Enums"]["membership_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_memberships_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          created_by_user_id: string
          entry_mode: Database["public"]["Enums"]["organization_entry_mode"]
          id: string
          logo_url: string | null
          name: string
          slug: string
          timezone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by_user_id: string
          entry_mode?: Database["public"]["Enums"]["organization_entry_mode"]
          id?: string
          logo_url?: string | null
          name: string
          slug: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by_user_id?: string
          entry_mode?: Database["public"]["Enums"]["organization_entry_mode"]
          id?: string
          logo_url?: string | null
          name?: string
          slug?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          permission: Database["public"]["Enums"]["app_permission"]
          role: Database["public"]["Enums"]["organization_role"]
        }
        Insert: {
          permission: Database["public"]["Enums"]["app_permission"]
          role: Database["public"]["Enums"]["organization_role"]
        }
        Update: {
          permission?: Database["public"]["Enums"]["app_permission"]
          role?: Database["public"]["Enums"]["organization_role"]
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          created_at: string
          full_name: string | null
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      visit_qr_credentials: {
        Row: {
          expires_at: string | null
          id: string
          issued_at: string
          last_used_at: string | null
          organization_id: string
          revoked_at: string | null
          token_hash: string
          visit_id: string
        }
        Insert: {
          expires_at?: string | null
          id?: string
          issued_at?: string
          last_used_at?: string | null
          organization_id: string
          revoked_at?: string | null
          token_hash: string
          visit_id: string
        }
        Update: {
          expires_at?: string | null
          id?: string
          issued_at?: string
          last_used_at?: string | null
          organization_id?: string
          revoked_at?: string | null
          token_hash?: string
          visit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "visit_qr_credentials_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visit_qr_credentials_visit_fk"
            columns: ["visit_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "visits"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      visitors: {
        Row: {
          created_at: string
          created_by_membership_id: string | null
          full_name: string
          id: string
          organization_id: string
          phone: string | null
          phone_not_provided: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by_membership_id?: string | null
          full_name: string
          id?: string
          organization_id: string
          phone?: string | null
          phone_not_provided?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by_membership_id?: string | null
          full_name?: string
          id?: string
          organization_id?: string
          phone?: string | null
          phone_not_provided?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "visitors_creator_fk"
            columns: ["created_by_membership_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "organization_memberships"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "visitors_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      visits: {
        Row: {
          checked_in_at: string | null
          checked_in_by_membership_id: string | null
          checked_out_at: string | null
          checked_out_by_membership_id: string | null
          created_by_membership_id: string | null
          entry_method: Database["public"]["Enums"]["visit_entry_method"]
          group_size: number
          host_code_attempt_id: number | null
          host_membership_id: string
          id: string
          invitation_credential_id: string | null
          organization_id: string
          purpose: string
          registered_at: string
          status: Database["public"]["Enums"]["visit_status"]
          updated_at: string
          visit_reference: string
          visitor_id: string
        }
        Insert: {
          checked_in_at?: string | null
          checked_in_by_membership_id?: string | null
          checked_out_at?: string | null
          checked_out_by_membership_id?: string | null
          created_by_membership_id?: string | null
          entry_method: Database["public"]["Enums"]["visit_entry_method"]
          group_size?: number
          host_code_attempt_id?: number | null
          host_membership_id: string
          id?: string
          invitation_credential_id?: string | null
          organization_id: string
          purpose: string
          registered_at?: string
          status: Database["public"]["Enums"]["visit_status"]
          updated_at?: string
          visit_reference?: string
          visitor_id: string
        }
        Update: {
          checked_in_at?: string | null
          checked_in_by_membership_id?: string | null
          checked_out_at?: string | null
          checked_out_by_membership_id?: string | null
          created_by_membership_id?: string | null
          entry_method?: Database["public"]["Enums"]["visit_entry_method"]
          group_size?: number
          host_code_attempt_id?: number | null
          host_membership_id?: string
          id?: string
          invitation_credential_id?: string | null
          organization_id?: string
          purpose?: string
          registered_at?: string
          status?: Database["public"]["Enums"]["visit_status"]
          updated_at?: string
          visit_reference?: string
          visitor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "visits_checkin_actor_fk"
            columns: ["checked_in_by_membership_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "organization_memberships"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "visits_checkout_actor_fk"
            columns: ["checked_out_by_membership_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "organization_memberships"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "visits_creator_fk"
            columns: ["created_by_membership_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "organization_memberships"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "visits_host_code_attempt_fk"
            columns: ["host_code_attempt_id"]
            isOneToOne: true
            referencedRelation: "host_code_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visits_host_fk"
            columns: ["host_membership_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "organization_memberships"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "visits_invitation_fk"
            columns: [
              "invitation_credential_id",
              "organization_id",
              "host_membership_id",
            ]
            isOneToOne: false
            referencedRelation: "invitation_credentials"
            referencedColumns: ["id", "organization_id", "host_membership_id"]
          },
          {
            foreignKeyName: "visits_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visits_visitor_fk"
            columns: ["visitor_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "visitors"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_membership_invitation: {
        Args: { p_token_hash: string }
        Returns: {
          assigned_role: Database["public"]["Enums"]["organization_role"]
          membership_id: string
          organization_id: string
        }[]
      }
      check_in_visit_by_qr: {
        Args: { p_qr_token_hash: string }
        Returns: {
          checked_in_visit_id: string
          checked_in_visit_reference: string
        }[]
      }
      check_out_visit: {
        Args: { p_visit_id: string }
        Returns: {
          checked_out_visit_id: string
          checked_out_visit_reference: string
        }[]
      }
      create_membership_invitation: {
        Args: {
          p_expires_at: string
          p_invited_email: string
          p_organization_id: string
          p_role: Database["public"]["Enums"]["organization_role"]
          p_token_hash: string
        }
        Returns: {
          invitation_expires_at: string
          invitation_id: string
        }[]
      }
      create_organization_join_link: {
        Args: {
          p_default_role: Database["public"]["Enums"]["organization_role"]
          p_expires_at: string
          p_token_hash: string
        }
        Returns: {
          join_link_expires_at: string
          join_link_id: string
        }[]
      }
      create_organization_with_admin: {
        Args: { p_name: string; p_slug: string; p_timezone?: string }
        Returns: {
          membership_id: string
          organization_id: string
        }[]
      }
      get_admin_visit_metrics: {
        Args: never
        Returns: {
          people_count: number
          visit_count: number
          visit_status: Database["public"]["Enums"]["visit_status"]
        }[]
      }
      get_currently_inside: {
        Args: never
        Returns: {
          checked_in_at: string
          group_size: number
          host_name: string
          purpose: string
          visit_id: string
          visit_reference: string
          visitor_name: string
        }[]
      }
      issue_host_credentials: {
        Args: { p_host_code_hash: string; p_invitation_token_hash: string }
        Returns: {
          host_code_expires_at: string
          invitation_expires_at: string
        }[]
      }
      list_active_hosts: {
        Args: never
        Returns: {
          host_membership_id: string
          host_name: string
        }[]
      }
      list_organization_invitations: {
        Args: { p_organization_id: string }
        Returns: {
          created_at: string
          expires_at: string
          invitation_id: string
          invitation_status: string
          invited_email: string
          invited_role: Database["public"]["Enums"]["organization_role"]
        }[]
      }
      list_organization_join_access: {
        Args: never
        Returns: {
          created_at: string
          display_name: string
          email_verified: boolean
          expires_at: string
          record_id: string
          record_type: string
          role: Database["public"]["Enums"]["organization_role"]
          status: string
        }[]
      }
      manage_organization_membership: {
        Args: {
          p_membership_id: string
          p_organization_id: string
          p_role: Database["public"]["Enums"]["organization_role"]
          p_status: Database["public"]["Enums"]["membership_status"]
        }
        Returns: boolean
      }
      preview_visit_by_qr: {
        Args: { p_qr_token_hash: string }
        Returns: {
          group_size: number
          host_name: string
          purpose: string
          visit_id: string
          visit_reference: string
          visit_status: Database["public"]["Enums"]["visit_status"]
          visitor_name: string
          visitor_phone: string
        }[]
      }
      register_gate_visit: {
        Args: {
          p_full_name: string
          p_group_size: number
          p_host_code_attempt_id?: number
          p_host_membership_id: string
          p_phone: string
          p_phone_not_provided: boolean
          p_purpose: string
        }
        Returns: {
          registered_visit_id: string
          registered_visit_reference: string
        }[]
      }
      register_invited_visit: {
        Args: {
          p_full_name: string
          p_group_size?: number
          p_invitation_token_hash: string
          p_phone: string
          p_purpose: string
          p_qr_token_hash: string
        }
        Returns: {
          registered_visit_id: string
          registered_visit_reference: string
        }[]
      }
      request_organization_membership: {
        Args: { p_token_hash: string }
        Returns: {
          organization_id: string
          request_id: string
          requested_role: Database["public"]["Enums"]["organization_role"]
        }[]
      }
      review_organization_membership_request: {
        Args: {
          p_assigned_role: Database["public"]["Enums"]["organization_role"]
          p_decision: string
          p_request_id: string
        }
        Returns: boolean
      }
      revoke_membership_invitation: {
        Args: { p_invitation_id: string; p_organization_id: string }
        Returns: boolean
      }
      revoke_organization_join_link: {
        Args: { p_join_link_id: string }
        Returns: boolean
      }
      rotate_organization_join_link: {
        Args: {
          p_expires_at: string
          p_join_link_id: string
          p_token_hash: string
        }
        Returns: {
          join_link_expires_at: string
          join_link_id: string
        }[]
      }
      verify_host_code: {
        Args: { p_code_hash: string; p_organization_id: string }
        Returns: {
          verified_attempt_id: number
          verified_host_membership_id: string
          verified_host_name: string
          verified_host_user_id: string
        }[]
      }
    }
    Enums: {
      app_permission:
        | "organization_view"
        | "membership_manage"
        | "visit_view_all"
        | "visit_view_inside"
        | "gate_operate"
        | "invitation_issue"
        | "host_code_issue"
        | "host_code_verify"
        | "audit_view"
      audit_actor_type: "authenticated_user" | "public_visitor" | "system"
      membership_status: "active" | "suspended" | "revoked"
      organization_entry_mode: "both" | "invitation_only" | "direct_gate_only"
      organization_role: "admin" | "host" | "security"
      visit_entry_method: "invitation" | "direct_gate" | "host_verified"
      visit_status: "expected" | "inside" | "left"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_permission: [
        "organization_view",
        "membership_manage",
        "visit_view_all",
        "visit_view_inside",
        "gate_operate",
        "invitation_issue",
        "host_code_issue",
        "host_code_verify",
        "audit_view",
      ],
      audit_actor_type: ["authenticated_user", "public_visitor", "system"],
      membership_status: ["active", "suspended", "revoked"],
      organization_entry_mode: ["both", "invitation_only", "direct_gate_only"],
      organization_role: ["admin", "host", "security"],
      visit_entry_method: ["invitation", "direct_gate", "host_verified"],
      visit_status: ["expected", "inside", "left"],
    },
  },
} as const
