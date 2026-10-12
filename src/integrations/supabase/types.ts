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
      bookings: {
        Row: {
          booking_number: number
          created_at: string
          customer_name: string
          email: string | null
          event_date: string
          event_time: string | null
          event_type: string
          guests: number
          id: string
          notes: string | null
          package_name: string
          phone: string
          status: Database["public"]["Enums"]["booking_status"]
          venue: string
        }
        Insert: {
          booking_number?: never
          created_at?: string
          customer_name: string
          email?: string | null
          event_date: string
          event_time?: string | null
          event_type: string
          guests: number
          id?: string
          notes?: string | null
          package_name: string
          phone: string
          status?: Database["public"]["Enums"]["booking_status"]
          venue: string
        }
        Update: {
          booking_number?: never
          created_at?: string
          customer_name?: string
          email?: string | null
          event_date?: string
          event_time?: string | null
          event_type?: string
          guests?: number
          id?: string
          notes?: string | null
          package_name?: string
          phone?: string
          status?: Database["public"]["Enums"]["booking_status"]
          venue?: string
        }
        Relationships: []
      }
      business_settings: {
        Row: {
          key: string
          value: string
          updated_at: string
        }
        Insert: {
          key: string
          value: string
          updated_at?: string
        }
        Update: {
          key?: string
          value?: string
          updated_at?: string
        }
        Relationships: []
      }
      menu_items: {
        Row: {
          available: boolean
          category: string
          created_at: string
          description: string
          id: string
          image_key: string | null
          name: string
          popular: boolean
          price: number
          sort_order: number
        }
        Insert: {
          available?: boolean
          category: string
          created_at?: string
          description?: string
          id?: string
          image_key?: string | null
          name: string
          popular?: boolean
          price: number
          sort_order?: number
        }
        Update: {
          available?: boolean
          category?: string
          created_at?: string
          description?: string
          id?: string
          image_key?: string | null
          name?: string
          popular?: boolean
          price?: number
          sort_order?: number
        }
        Relationships: []
      }
      orders: {
        Row: {
          address: string | null
          created_at: string
          customer_email: string | null
          customer_name: string
          delivery_lat: number | null
          delivery_lng: number | null
          fulfillment: string
          id: string
          items: Json
          notes: string | null
          order_number: number
          payment_from: string | null
          payment_method: string
          payment_reference: string | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          payment_to: string | null
          phone: string
          status: Database["public"]["Enums"]["order_status"]
          total: number
        }
        Insert: {
          address?: string | null
          created_at?: string
          customer_email?: string | null
          customer_name: string
          delivery_lat?: number | null
          delivery_lng?: number | null
          fulfillment: string
          id?: string
          items: Json
          notes?: string | null
          order_number?: never
          payment_from?: string | null
          payment_method: string
          payment_reference?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          payment_to?: string | null
          phone: string
          status?: Database["public"]["Enums"]["order_status"]
          total: number
        }
        Update: {
          address?: string | null
          created_at?: string
          customer_email?: string | null
          customer_name?: string
          delivery_lat?: number | null
          delivery_lng?: number | null
          fulfillment?: string
          id?: string
          items?: Json
          notes?: string | null
          order_number?: never
          payment_from?: string | null
          payment_method?: string
          payment_reference?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          payment_to?: string | null
          phone?: string
          status?: Database["public"]["Enums"]["order_status"]
          total?: number
        }
        Relationships: []
      }
      payment_transactions: {
        Row: {
          id: string
          order_id: string
          order_number: number
          tx_ref: string
          provider: string
          transaction_id: number | null
          flw_ref: string | null
          amount: number
          currency: string
          payment_method: string
          status: string
          provider_status: string | null
          provider_message: string | null
          checkout_url: string | null
          raw_response: Json | null
          webhook_payload: Json | null
          verified_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          order_id: string
          order_number: number
          tx_ref: string
          provider?: string
          transaction_id?: number | null
          flw_ref?: string | null
          amount: number
          currency?: string
          payment_method?: string
          status?: string
          provider_status?: string | null
          provider_message?: string | null
          checkout_url?: string | null
          raw_response?: Json | null
          webhook_payload?: Json | null
          verified_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          order_id?: string
          order_number?: number
          tx_ref?: string
          provider?: string
          transaction_id?: number | null
          flw_ref?: string | null
          amount?: number
          currency?: string
          payment_method?: string
          status?: string
          provider_status?: string | null
          provider_message?: string | null
          checkout_url?: string | null
          raw_response?: Json | null
          webhook_payload?: Json | null
          verified_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
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
      create_booking: {
        Args: {
          p_customer_name: string
          p_email: string | null
          p_event_date: string
          p_event_time: string | null
          p_event_type: string
          p_guests: number
          p_notes: string | null
          p_package_name: string
          p_phone: string
          p_venue: string
        }
        Returns: { booking_number: number }[]
      }
      apply_flutterwave_result: {
        Args: {
          p_order_id: string
          p_tx_ref: string
          p_transaction_id: number
          p_flw_ref: string | null
          p_status: string
          p_provider_status: string
          p_provider_message: string
          p_raw_response: Json
          p_webhook_payload: Json | null
        }
        Returns: undefined
      }
      place_order: {
        Args: {
          p_address: string | null
          p_customer_email: string | null
          p_customer_name: string
          p_fulfillment: string
          p_items: Json
          p_notes: string | null
          p_payment_method: string
          p_payment_reference: string | null
          p_phone: string
        }
        Returns: { order_id: string; order_number: number; total: number; payment_status: Database["public"]["Enums"]["payment_status"] }[]
      }
      track_order: {
        Args: { p_order_number: number; p_phone: string }
        Returns: {
          created_at: string
          customer_name: string
          fulfillment: string
          items: Json
          order_number: number
          payment_status: Database["public"]["Enums"]["payment_status"]
          status: Database["public"]["Enums"]["order_status"]
          total: number
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "staff"
      booking_status: "Pending" | "Confirmed" | "Completed" | "Cancelled"
      order_status:
        | "New"
        | "Confirmed"
        | "Preparing"
        | "Ready"
        | "Delivered"
        | "Cancelled"
      payment_status:
        | "Cash due"
        | "Awaiting verification"
        | "Verified"
        | "Not received"
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
      app_role: ["admin", "staff"],
      booking_status: ["Pending", "Confirmed", "Completed", "Cancelled"],
      order_status: [
        "New",
        "Confirmed",
        "Preparing",
        "Ready",
        "Delivered",
        "Cancelled",
      ],
      payment_status: [
        "Cash due",
        "Awaiting verification",
        "Verified",
        "Not received",
      ],
    },
  },
} as const
