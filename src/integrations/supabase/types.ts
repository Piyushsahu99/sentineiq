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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      ai_investigations: {
        Row: {
          attack_type: string | null
          business_impact: number | null
          compliance: Json | null
          confidence: number
          created_at: string
          customer_id: string | null
          evidence: Json | null
          id: string
          recommended_actions: Json | null
          risk_factors: Json | null
          root_cause: string | null
          status: string
          title: string
          transaction_id: string | null
        }
        Insert: {
          attack_type?: string | null
          business_impact?: number | null
          compliance?: Json | null
          confidence?: number
          created_at?: string
          customer_id?: string | null
          evidence?: Json | null
          id?: string
          recommended_actions?: Json | null
          risk_factors?: Json | null
          root_cause?: string | null
          status?: string
          title: string
          transaction_id?: string | null
        }
        Update: {
          attack_type?: string | null
          business_impact?: number | null
          compliance?: Json | null
          confidence?: number
          created_at?: string
          customer_id?: string | null
          evidence?: Json | null
          id?: string
          recommended_actions?: Json | null
          risk_factors?: Json | null
          root_cause?: string | null
          status?: string
          title?: string
          transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_investigations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_investigations_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      alerts: {
        Row: {
          assignee: string | null
          created_at: string
          customer_id: string | null
          id: string
          investigation_id: string | null
          severity: string
          sla_minutes: number | null
          source: string | null
          status: string
          title: string
          transaction_id: string | null
          updated_at: string
        }
        Insert: {
          assignee?: string | null
          created_at?: string
          customer_id?: string | null
          id?: string
          investigation_id?: string | null
          severity?: string
          sla_minutes?: number | null
          source?: string | null
          status?: string
          title: string
          transaction_id?: string | null
          updated_at?: string
        }
        Update: {
          assignee?: string | null
          created_at?: string
          customer_id?: string | null
          id?: string
          investigation_id?: string | null
          severity?: string
          sla_minutes?: number | null
          source?: string | null
          status?: string
          title?: string
          transaction_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "alerts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_investigation_id_fkey"
            columns: ["investigation_id"]
            isOneToOne: false
            referencedRelation: "ai_investigations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      beneficiaries: {
        Row: {
          country: string | null
          created_at: string | null
          customer_id: string | null
          iban: string | null
          id: string
          name: string
          trusted: boolean | null
        }
        Insert: {
          country?: string | null
          created_at?: string | null
          customer_id?: string | null
          iban?: string | null
          id?: string
          name: string
          trusted?: boolean | null
        }
        Update: {
          country?: string | null
          created_at?: string | null
          customer_id?: string | null
          iban?: string | null
          id?: string
          name?: string
          trusted?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "beneficiaries_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          country: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          risk_baseline: number
          segment: string | null
        }
        Insert: {
          country?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          risk_baseline?: number
          segment?: string | null
        }
        Update: {
          country?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          risk_baseline?: number
          segment?: string | null
        }
        Relationships: []
      }
      cyber_telemetry: {
        Row: {
          created_at: string
          device: string | null
          id: string
          ip: unknown
          message: string | null
          metadata: Json | null
          risk_score: number | null
          severity: string
          source: string
          user_ref: string | null
        }
        Insert: {
          created_at?: string
          device?: string | null
          id?: string
          ip?: unknown
          message?: string | null
          metadata?: Json | null
          risk_score?: number | null
          severity?: string
          source: string
          user_ref?: string | null
        }
        Update: {
          created_at?: string
          device?: string | null
          id?: string
          ip?: unknown
          message?: string | null
          metadata?: Json | null
          risk_score?: number | null
          severity?: string
          source?: string
          user_ref?: string | null
        }
        Relationships: []
      }
      devices: {
        Row: {
          browser: string | null
          customer_id: string | null
          fingerprint: string
          id: string
          last_seen: string | null
          os: string | null
          trusted: boolean | null
        }
        Insert: {
          browser?: string | null
          customer_id?: string | null
          fingerprint: string
          id?: string
          last_seen?: string | null
          os?: string | null
          trusted?: boolean | null
        }
        Update: {
          browser?: string | null
          customer_id?: string | null
          fingerprint?: string
          id?: string
          last_seen?: string | null
          os?: string | null
          trusted?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "devices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      iocs: {
        Row: {
          id: string
          last_seen: string | null
          seen_count: number | null
          severity: string
          threat_id: string | null
          type: string
          value: string
        }
        Insert: {
          id?: string
          last_seen?: string | null
          seen_count?: number | null
          severity?: string
          threat_id?: string | null
          type: string
          value: string
        }
        Update: {
          id?: string
          last_seen?: string | null
          seen_count?: number | null
          severity?: string
          threat_id?: string | null
          type?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "iocs_threat_id_fkey"
            columns: ["threat_id"]
            isOneToOne: false
            referencedRelation: "threat_intel"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_edges: {
        Row: {
          created_at: string
          dst_id: string
          dst_type: string
          id: string
          src_id: string
          src_type: string
          weight: number | null
        }
        Insert: {
          created_at?: string
          dst_id: string
          dst_type: string
          id?: string
          src_id: string
          src_type: string
          weight?: number | null
        }
        Update: {
          created_at?: string
          dst_id?: string
          dst_type?: string
          id?: string
          src_id?: string
          src_type?: string
          weight?: number | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          alert_id: string | null
          body: string | null
          created_at: string
          id: string
          read: boolean | null
          severity: string | null
          title: string
        }
        Insert: {
          alert_id?: string | null
          body?: string | null
          created_at?: string
          id?: string
          read?: boolean | null
          severity?: string | null
          title: string
        }
        Update: {
          alert_id?: string | null
          body?: string | null
          created_at?: string
          id?: string
          read?: boolean | null
          severity?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_alert_id_fkey"
            columns: ["alert_id"]
            isOneToOne: false
            referencedRelation: "alerts"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
        }
        Relationships: []
      }
      quantum_assets: {
        Row: {
          algo: string
          asset: string
          created_at: string | null
          expires_at: string | null
          id: string
          key_size: number | null
          migration_status: string | null
          sensitivity: number | null
          tls_version: string | null
        }
        Insert: {
          algo: string
          asset: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          key_size?: number | null
          migration_status?: string | null
          sensitivity?: number | null
          tls_version?: string | null
        }
        Update: {
          algo?: string
          asset?: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          key_size?: number | null
          migration_status?: string | null
          sensitivity?: number | null
          tls_version?: string | null
        }
        Relationships: []
      }
      risk_scores: {
        Row: {
          composite: number
          contributors: Json
          created_at: string
          customer_id: string | null
          id: string
          transaction_id: string | null
        }
        Insert: {
          composite: number
          contributors?: Json
          created_at?: string
          customer_id?: string | null
          id?: string
          transaction_id?: string | null
        }
        Update: {
          composite?: number
          contributors?: Json
          created_at?: string
          customer_id?: string | null
          id?: string
          transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "risk_scores_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "risk_scores_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          city: string | null
          country: string | null
          customer_id: string | null
          device_id: string | null
          id: string
          ip: unknown
          is_tor: boolean | null
          is_vpn: boolean | null
          started_at: string
        }
        Insert: {
          city?: string | null
          country?: string | null
          customer_id?: string | null
          device_id?: string | null
          id?: string
          ip?: unknown
          is_tor?: boolean | null
          is_vpn?: boolean | null
          started_at?: string
        }
        Update: {
          city?: string | null
          country?: string | null
          customer_id?: string | null
          device_id?: string | null
          id?: string
          ip?: unknown
          is_tor?: boolean | null
          is_vpn?: boolean | null
          started_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
        ]
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      threat_intel: {
        Row: {
          description: string | null
          first_seen: string | null
          id: string
          kind: string
          name: string
          origin_country: string | null
          severity: string
        }
        Insert: {
          description?: string | null
          first_seen?: string | null
          id?: string
          kind: string
          name: string
          origin_country?: string | null
          severity?: string
        }
        Update: {
          description?: string | null
          first_seen?: string | null
          id?: string
          kind?: string
          name?: string
          origin_country?: string | null
          severity?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          beneficiary_id: string | null
          channel: string
          country: string | null
          created_at: string
          currency: string
          customer_id: string
          device_id: string | null
          id: string
          merchant: string | null
          risk_score: number | null
          session_id: string | null
          status: string
        }
        Insert: {
          amount: number
          beneficiary_id?: string | null
          channel?: string
          country?: string | null
          created_at?: string
          currency?: string
          customer_id: string
          device_id?: string | null
          id?: string
          merchant?: string | null
          risk_score?: number | null
          session_id?: string | null
          status?: string
        }
        Update: {
          amount?: number
          beneficiary_id?: string | null
          channel?: string
          country?: string | null
          created_at?: string
          currency?: string
          customer_id?: string
          device_id?: string | null
          id?: string
          merchant?: string | null
          risk_score?: number | null
          session_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_beneficiary_id_fkey"
            columns: ["beneficiary_id"]
            isOneToOne: false
            referencedRelation: "beneficiaries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      assign_initial_role: {
        Args: { _role: Database["public"]["Enums"]["app_role"] }
        Returns: undefined
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_analyst: { Args: { _user_id: string }; Returns: boolean }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
    }
    Enums: {
      app_role: "soc_analyst" | "fraud_analyst" | "risk_manager" | "executive"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      app_role: ["soc_analyst", "fraud_analyst", "risk_manager", "executive"],
    },
  },
} as const
