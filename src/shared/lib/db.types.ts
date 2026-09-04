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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      catalog_products: {
        Row: {
          barcode: string | null
          brand: string | null
          currency: string
          external_id: string
          id: string
          image_url: string | null
          name: string
          normalized_name: string
          package_size: string | null
          price_cents: number | null
          price_checked_at: string | null
          supermarket_id: string
          updated_at: string
        }
        Insert: {
          barcode?: string | null
          brand?: string | null
          currency?: string
          external_id: string
          id?: string
          image_url?: string | null
          name: string
          normalized_name: string
          package_size?: string | null
          price_cents?: number | null
          price_checked_at?: string | null
          supermarket_id: string
          updated_at?: string
        }
        Update: {
          barcode?: string | null
          brand?: string | null
          currency?: string
          external_id?: string
          id?: string
          image_url?: string | null
          name?: string
          normalized_name?: string
          package_size?: string | null
          price_cents?: number | null
          price_checked_at?: string | null
          supermarket_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "catalog_products_supermarket_id_fkey"
            columns: ["supermarket_id"]
            isOneToOne: false
            referencedRelation: "supermarkets"
            referencedColumns: ["id"]
          },
        ]
      }
      communities: {
        Row: {
          created_at: string
          id: string
          join_code: string
          join_code_expires_at: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          join_code: string
          join_code_expires_at?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          join_code?: string
          join_code_expires_at?: string
          name?: string
        }
        Relationships: []
      }
      expense_shares: {
        Row: {
          created_at: string
          expense_id: string
          id: string
          member_id: string
          share_cents: number
        }
        Insert: {
          created_at?: string
          expense_id: string
          id?: string
          member_id: string
          share_cents: number
        }
        Update: {
          created_at?: string
          expense_id?: string
          id?: string
          member_id?: string
          share_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "expense_shares_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_shares_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount_cents: number
          community_id: string
          created_at: string
          created_by_auth_user_id: string
          currency: string
          description: string
          id: string
          item_id: string | null
          paid_by_member_id: string
          updated_at: string
        }
        Insert: {
          amount_cents: number
          community_id: string
          created_at?: string
          created_by_auth_user_id?: string
          currency?: string
          description: string
          id?: string
          item_id?: string | null
          paid_by_member_id: string
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          community_id?: string
          created_at?: string
          created_by_auth_user_id?: string
          currency?: string
          description?: string
          id?: string
          item_id?: string | null
          paid_by_member_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_paid_by_member_id_fkey"
            columns: ["paid_by_member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      items: {
        Row: {
          catalog_product_id: string | null
          community_id: string
          created_at: string
          created_by: string | null
          id: string
          image_path: string | null
          is_purchased: boolean
          name: string
          quantity: number
          updated_at: string
        }
        Insert: {
          catalog_product_id?: string | null
          community_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          image_path?: string | null
          is_purchased?: boolean
          name: string
          quantity?: number
          updated_at?: string
        }
        Update: {
          catalog_product_id?: string | null
          community_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          image_path?: string | null
          is_purchased?: boolean
          name?: string
          quantity?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "items_catalog_product_id_fkey"
            columns: ["catalog_product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      join_attempts: {
        Row: {
          attempted_at: string
          auth_user_id: string
          id: string
          succeeded: boolean
        }
        Insert: {
          attempted_at?: string
          auth_user_id: string
          id?: string
          succeeded?: boolean
        }
        Update: {
          attempted_at?: string
          auth_user_id?: string
          id?: string
          succeeded?: boolean
        }
        Relationships: []
      }
      members: {
        Row: {
          auth_user_id: string | null
          community_id: string
          created_at: string
          id: string
          is_admin: boolean
          pin_hash: string | null
          removed_at: string | null
          username: string
        }
        Insert: {
          auth_user_id?: string | null
          community_id: string
          created_at?: string
          id?: string
          is_admin?: boolean
          pin_hash?: string | null
          removed_at?: string | null
          username: string
        }
        Update: {
          auth_user_id?: string | null
          community_id?: string
          created_at?: string
          id?: string
          is_admin?: boolean
          pin_hash?: string | null
          removed_at?: string | null
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "members_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
      settlements: {
        Row: {
          amount_cents: number
          community_id: string
          created_at: string
          created_by_auth_user_id: string
          currency: string
          from_member_id: string
          id: string
          to_member_id: string
        }
        Insert: {
          amount_cents: number
          community_id: string
          created_at?: string
          created_by_auth_user_id?: string
          currency?: string
          from_member_id: string
          id?: string
          to_member_id: string
        }
        Update: {
          amount_cents?: number
          community_id?: string
          created_at?: string
          created_by_auth_user_id?: string
          currency?: string
          from_member_id?: string
          id?: string
          to_member_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "settlements_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlements_from_member_id_fkey"
            columns: ["from_member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlements_to_member_id_fkey"
            columns: ["to_member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      supermarkets: {
        Row: {
          country: string
          id: string
          name: string
        }
        Insert: {
          country: string
          id: string
          name: string
        }
        Update: {
          country?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_guest_member: {
        Args: { p_community_id: string; p_username: string }
        Returns: {
          id: string
          username: string
        }[]
      }
      create_community: {
        Args: { p_name: string; p_pin?: string; p_username: string }
        Returns: {
          community_id: string
          join_code: string
        }[]
      }
      create_expense_with_shares: {
        Args: {
          p_amount_cents: number
          p_community_id: string
          p_description: string
          p_expense_id?: string
          p_item_id: string
          p_paid_by_member_id: string
          p_shares: Json
        }
        Returns: string
      }
      current_member_id: { Args: { p_community_id: string }; Returns: string }
      generate_join_code: { Args: never; Returns: string }
      join_code_lifetime: { Args: never; Returns: string }
      join_community: {
        Args: { p_join_code: string; p_pin?: string; p_username: string }
        Returns: {
          community_id: string
          status: string
        }[]
      }
      member_community_ids: { Args: never; Returns: string[] }
      ping: { Args: never; Returns: string }
      remove_member: {
        Args: { p_community_id: string; p_member_id: string }
        Returns: {
          status: string
        }[]
      }
      rotate_join_code: {
        Args: { p_community_id: string }
        Returns: {
          expires_at: string
          join_code: string
        }[]
      }
      search_catalog: {
        Args: { p_limit?: number; p_query: string; p_supermarket_id?: string }
        Returns: {
          brand: string
          currency: string
          id: string
          image_url: string
          name: string
          normalized_name: string
          package_size: string
          price_cents: number
          price_checked_at: string
          similarity: number
          supermarket_id: string
        }[]
      }
      set_member_admin: {
        Args: {
          p_community_id: string
          p_is_admin: boolean
          p_member_id: string
        }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
