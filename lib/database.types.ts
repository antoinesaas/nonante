// Types de la base, au format de `supabase gen types typescript`.
// À régénérer après chaque migration (voir README, « Types de la base »).

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "13.0.5";
  };
  public: {
    Tables: {
      cohorts: {
        Row: {
          created_at: string;
          early_price_cents: number;
          end_date: string;
          enroll_open: boolean;
          id: string;
          name: string;
          price_cents: number;
          start_date: string;
          stripe_early_price_id: string | null;
          stripe_price_id: string | null;
        };
        Insert: {
          created_at?: string;
          early_price_cents?: number;
          end_date?: never;
          enroll_open?: boolean;
          id?: string;
          name: string;
          price_cents?: number;
          start_date: string;
          stripe_early_price_id?: string | null;
          stripe_price_id?: string | null;
        };
        Update: {
          created_at?: string;
          early_price_cents?: number;
          end_date?: never;
          enroll_open?: boolean;
          id?: string;
          name?: string;
          price_cents?: number;
          start_date?: string;
          stripe_early_price_id?: string | null;
          stripe_price_id?: string | null;
        };
        Relationships: [];
      };
      presales: {
        Row: {
          amount_paid_cents: number;
          claimed_at: string | null;
          claimed_by: string | null;
          cohort_id: string;
          created_at: string;
          currency: string;
          email: string;
          id: string;
          paid_at: string;
          refunded_at: string | null;
          stripe_checkout_session_id: string;
          stripe_customer_id: string | null;
          stripe_payment_intent_id: string | null;
          stripe_promotion_code_id: string | null;
          utm_campaign: string | null;
          utm_source: string | null;
        };
        Insert: {
          amount_paid_cents: number;
          claimed_at?: string | null;
          claimed_by?: string | null;
          cohort_id: string;
          created_at?: string;
          currency?: string;
          email: string;
          id?: string;
          paid_at?: string;
          refunded_at?: string | null;
          stripe_checkout_session_id: string;
          stripe_customer_id?: string | null;
          stripe_payment_intent_id?: string | null;
          stripe_promotion_code_id?: string | null;
          utm_campaign?: string | null;
          utm_source?: string | null;
        };
        Update: {
          amount_paid_cents?: number;
          claimed_at?: string | null;
          claimed_by?: string | null;
          cohort_id?: string;
          created_at?: string;
          currency?: string;
          email?: string;
          id?: string;
          paid_at?: string;
          refunded_at?: string | null;
          stripe_checkout_session_id?: string;
          stripe_customer_id?: string | null;
          stripe_payment_intent_id?: string | null;
          stripe_promotion_code_id?: string | null;
          utm_campaign?: string | null;
          utm_source?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "presales_cohort_id_fkey";
            columns: ["cohort_id"];
            isOneToOne: false;
            referencedRelation: "cohorts";
            referencedColumns: ["id"];
          },
        ];
      };
      rate_limits: {
        Row: { bucket: string; hits: number; reset_at: string };
        Insert: { bucket: string; hits: number; reset_at: string };
        Update: { bucket?: string; hits?: number; reset_at?: string };
        Relationships: [];
      };
      stripe_events: {
        Row: { id: string; processed_at: string; type: string };
        Insert: { id: string; processed_at?: string; type: string };
        Update: { id?: string; processed_at?: string; type?: string };
        Relationships: [];
      };
      waitlist: {
        Row: {
          cohort_id: string | null;
          created_at: string;
          email: string;
          id: string;
          utm_campaign: string | null;
          utm_source: string | null;
        };
        Insert: {
          cohort_id?: string | null;
          created_at?: string;
          email: string;
          id?: string;
          utm_campaign?: string | null;
          utm_source?: string | null;
        };
        Update: {
          cohort_id?: string | null;
          created_at?: string;
          email?: string;
          id?: string;
          utm_campaign?: string | null;
          utm_source?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "waitlist_cohort_id_fkey";
            columns: ["cohort_id"];
            isOneToOne: false;
            referencedRelation: "cohorts";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      cohort_signups: {
        Args: { p_cohort_id: string };
        Returns: number;
      };
      rate_limit_hit: {
        Args: { p_bucket: string; p_max: number; p_window_seconds: number };
        Returns: boolean;
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
