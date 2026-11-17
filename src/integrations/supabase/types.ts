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
      book_likes: {
        Row: {
          book_id: string
          created_at: string
          user_id: string
        }
        Insert: {
          book_id: string
          created_at?: string
          user_id: string
        }
        Update: {
          book_id?: string
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "book_likes_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "book_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      books: {
        Row: {
          author: string
          category: string | null
          coin_value: number
          condition: string
          cover_url: string | null
          created_at: string
          id: string
          isbn: string | null
          notes: string | null
          owner_id: string
          photo_paths: string[]
          status: string
          synopsis: string | null
          tier: string
          title: string
        }
        Insert: {
          author: string
          category?: string | null
          coin_value: number
          condition: string
          cover_url?: string | null
          created_at?: string
          id?: string
          isbn?: string | null
          notes?: string | null
          owner_id: string
          photo_paths: string[]
          status?: string
          synopsis?: string | null
          tier: string
          title: string
        }
        Update: {
          author?: string
          category?: string | null
          coin_value?: number
          condition?: string
          cover_url?: string | null
          created_at?: string
          id?: string
          isbn?: string | null
          notes?: string | null
          owner_id?: string
          photo_paths?: string[]
          status?: string
          synopsis?: string | null
          tier?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "books_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          match_id: string
          sender_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          match_id: string
          sender_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          match_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      match_pins: {
        Row: {
          failed_attempts: number
          match_id: string
          pin: string
          user_id: string
        }
        Insert: {
          failed_attempts?: number
          match_id: string
          pin: string
          user_id: string
        }
        Update: {
          failed_attempts?: number
          match_id?: string
          pin?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_pins_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_pins_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          book_a: string | null
          book_b: string | null
          created_at: string
          fee_paid_a: boolean
          fee_paid_b: boolean
          finished_at: string | null
          id: string
          kind: string
          received_a: boolean
          received_b: boolean
          status: string
          user_a: string
          user_b: string
        }
        Insert: {
          book_a?: string | null
          book_b?: string | null
          created_at?: string
          fee_paid_a?: boolean
          fee_paid_b?: boolean
          finished_at?: string | null
          id?: string
          kind?: string
          received_a?: boolean
          received_b?: boolean
          status?: string
          user_a: string
          user_b: string
        }
        Update: {
          book_a?: string | null
          book_b?: string | null
          created_at?: string
          fee_paid_a?: boolean
          fee_paid_b?: boolean
          finished_at?: string | null
          id?: string
          kind?: string
          received_a?: boolean
          received_b?: boolean
          status?: string
          user_a?: string
          user_b?: string
        }
        Relationships: [
          {
            foreignKeyName: "matches_book_a_fkey"
            columns: ["book_a"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_book_b_fkey"
            columns: ["book_b"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_user_a_fkey"
            columns: ["user_a"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_user_b_fkey"
            columns: ["user_b"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          data: Json
          id: string
          kind: string
          push_sent_at: string | null
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          data?: Json
          id?: string
          kind: string
          push_sent_at?: string | null
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          data?: Json
          id?: string
          kind?: string
          push_sent_at?: string | null
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          banned_reason: string | null
          city: string | null
          created_at: string
          display_name: string
          district: string | null
          favorite_authors: string[]
          favorite_genres: string[]
          id: string
          status: string
          uf: string | null
          updated_at: string
          xp: number
        }
        Insert: {
          avatar_url?: string | null
          banned_reason?: string | null
          city?: string | null
          created_at?: string
          display_name?: string
          district?: string | null
          favorite_authors?: string[]
          favorite_genres?: string[]
          id: string
          status?: string
          uf?: string | null
          updated_at?: string
          xp?: number
        }
        Update: {
          avatar_url?: string | null
          banned_reason?: string | null
          city?: string | null
          created_at?: string
          display_name?: string
          district?: string | null
          favorite_authors?: string[]
          favorite_genres?: string[]
          id?: string
          status?: string
          uf?: string | null
          updated_at?: string
          xp?: number
        }
        Relationships: []
      }
      trade_ratings: {
        Row: {
          comment: string | null
          created_at: string
          match_id: string
          rater_id: string
          stars: number
        }
        Insert: {
          comment?: string | null
          created_at?: string
          match_id: string
          rater_id: string
          stars: number
        }
        Update: {
          comment?: string | null
          created_at?: string
          match_id?: string
          rater_id?: string
          stars?: number
        }
        Relationships: [
          {
            foreignKeyName: "trade_ratings_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_ratings_rater_id_fkey"
            columns: ["rater_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_private: {
        Row: {
          cep: string | null
          city: string | null
          cpf: string | null
          district: string | null
          number: string | null
          phone: string | null
          portaria_ok: boolean
          reference: string | null
          street: string | null
          uf: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cep?: string | null
          city?: string | null
          cpf?: string | null
          district?: string | null
          number?: string | null
          phone?: string | null
          portaria_ok?: boolean
          reference?: string | null
          street?: string | null
          uf?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cep?: string | null
          city?: string | null
          cpf?: string | null
          district?: string | null
          number?: string | null
          phone?: string | null
          portaria_ok?: boolean
          reference?: string | null
          street?: string | null
          uf?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_private_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      wallet_entries: {
        Row: {
          amount: number
          created_at: string
          expires_at: string | null
          id: string
          kind: string
          label: string
          locked: boolean
          reference_id: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          expires_at?: string | null
          id?: string
          kind: string
          label: string
          locked?: boolean
          reference_id?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          expires_at?: string | null
          id?: string
          kind?: string
          label?: string
          locked?: boolean
          reference_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_entries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      xp_events: {
        Row: {
          created_at: string
          delta: number
          id: string
          reason: string
          reference_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          delta: number
          id?: string
          reason: string
          reference_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          delta?: number
          id?: string
          reason?: string
          reference_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "xp_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      apply_deadline_penalty: {
        Args: { _reference?: string; _user_id: string }
        Returns: undefined
      }
      award_xp: {
        Args: {
          _delta: number
          _reason: string
          _reference?: string
          _user_id: string
        }
        Returns: undefined
      }
      ban_user_for_fraud: {
        Args: { _reason: string; _user_id: string }
        Returns: undefined
      }
      book_coin_value: {
        Args: { _condition: string; _tier: string }
        Returns: number
      }
      can_chat: { Args: { _match_id: string }; Returns: boolean }
      can_view_book_photo: { Args: { _object_name: string }; Returns: boolean }
      can_view_profile: { Args: { _profile_id: string }; Returns: boolean }
      confirm_handoff_pin: {
        Args: { _match_id: string; _pin: string }
        Returns: Json
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      notify_user: {
        Args: {
          _body: string
          _data?: Json
          _kind: string
          _title: string
          _user_id: string
        }
        Returns: undefined
      }
      rate_trade: {
        Args: { _comment?: string; _match_id: string; _stars: number }
        Returns: Json
      }
      register_book: {
        Args: {
          _author: string
          _category: string
          _condition: string
          _cover_url?: string
          _isbn: string
          _notes: string
          _photo_paths: string[]
          _synopsis?: string
          _tier: string
          _title: string
        }
        Returns: Json
      }
      request_uber_ready: { Args: { _match_id: string }; Returns: undefined }
      wallet_summary: {
        Args: never
        Returns: {
          balance: number
          promo_active: number
          welcome_locked: boolean
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
