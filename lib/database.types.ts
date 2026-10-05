// Généré par scripts/gen-types.mjs à partir des migrations. Ne pas modifier à la main.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  __InternalSupabase: { PostgrestVersion: "13.0.5" };
  public: {
    Tables: {
      achievements: {
        Row: {
          art_slug: string | null;
          code: string;
          description: string;
          id: string;
          points: number;
          sort: number;
          title: string;
        };
        Insert: {
          art_slug?: string | null;
          code: string;
          description: string;
          id?: string;
          points?: number;
          sort?: number;
          title: string;
        };
        Update: {
          art_slug?: string | null;
          code?: string;
          description?: string;
          id?: string;
          points?: number;
          sort?: number;
          title?: string;
        };
        Relationships: [];
      };
      app_opens: {
        Row: {
          day: string;
          enrollment_id: string;
        };
        Insert: {
          day: string;
          enrollment_id: string;
        };
        Update: {
          day?: string;
          enrollment_id?: string;
        };
        Relationships: [];
      };
      art_unlocks: {
        Row: {
          slug: string;
          unlock: string;
        };
        Insert: {
          slug: string;
          unlock: string;
        };
        Update: {
          slug?: string;
          unlock?: string;
        };
        Relationships: [];
      };
      audit_log: {
        Row: {
          action: string;
          admin_id: string | null;
          created_at: string;
          details: Json | null;
          id: number;
          target: string;
        };
        Insert: {
          action: string;
          admin_id?: string | null;
          created_at?: string;
          details?: Json | null;
          id?: number;
          target: string;
        };
        Update: {
          action?: string;
          admin_id?: string | null;
          created_at?: string;
          details?: Json | null;
          id?: number;
          target?: string;
        };
        Relationships: [];
      };
      audits: {
        Row: {
          challenge_proof_id: string | null;
          due_at: string;
          enrollment_id: string;
          id: string;
          penalty: number;
          photo_deleted_at: string | null;
          photo_path: string | null;
          requested_at: string;
          reviewed_at: string | null;
          reviewed_by: string | null;
          status: string;
          submitted_at: string | null;
          user_id: string;
          validation_id: string | null;
        };
        Insert: {
          challenge_proof_id?: string | null;
          due_at: string;
          enrollment_id: string;
          id?: string;
          penalty?: number;
          photo_deleted_at?: string | null;
          photo_path?: string | null;
          requested_at?: string;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: string;
          submitted_at?: string | null;
          user_id: string;
          validation_id?: string | null;
        };
        Update: {
          challenge_proof_id?: string | null;
          due_at?: string;
          enrollment_id?: string;
          id?: string;
          penalty?: number;
          photo_deleted_at?: string | null;
          photo_path?: string | null;
          requested_at?: string;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: string;
          submitted_at?: string | null;
          user_id?: string;
          validation_id?: string | null;
        };
        Relationships: [];
      };
      challenge_assignments: {
        Row: {
          challenge_id: string;
          created_at: string;
          enrollment_id: string;
          evaluated_at: string | null;
          id: string;
          status: string;
          validation_id: string | null;
          week: number;
        };
        Insert: {
          challenge_id: string;
          created_at?: string;
          enrollment_id: string;
          evaluated_at?: string | null;
          id?: string;
          status?: string;
          validation_id?: string | null;
          week: number;
        };
        Update: {
          challenge_id?: string;
          created_at?: string;
          enrollment_id?: string;
          evaluated_at?: string | null;
          id?: string;
          status?: string;
          validation_id?: string | null;
          week?: number;
        };
        Relationships: [];
      };
      challenge_proofs: {
        Row: {
          assignment_id: string;
          created_at: string;
          day: string;
          id: string;
          kind: string;
          link_url: string | null;
          photo_deleted_at: string | null;
          photo_path: string | null;
          status: string;
        };
        Insert: {
          assignment_id: string;
          created_at?: string;
          day: string;
          id?: string;
          kind: string;
          link_url?: string | null;
          photo_deleted_at?: string | null;
          photo_path?: string | null;
          status?: string;
        };
        Update: {
          assignment_id?: string;
          created_at?: string;
          day?: string;
          id?: string;
          kind?: string;
          link_url?: string | null;
          photo_deleted_at?: string | null;
          photo_path?: string | null;
          status?: string;
        };
        Relationships: [];
      };
      challenges: {
        Row: {
          category: string;
          code: string;
          description: string;
          forced_audit: boolean;
          id: string;
          kind: string;
          level: number;
          proof_type: string | null;
          rule: Json;
          title: string;
        };
        Insert: {
          category: string;
          code: string;
          description: string;
          forced_audit?: boolean;
          id?: string;
          kind: string;
          level: number;
          proof_type?: string | null;
          rule: Json;
          title: string;
        };
        Update: {
          category?: string;
          code?: string;
          description?: string;
          forced_audit?: boolean;
          id?: string;
          kind?: string;
          level?: number;
          proof_type?: string | null;
          rule?: Json;
          title?: string;
        };
        Relationships: [];
      };
      cohorts: {
        Row: {
          closed_at: string | null;
          created_at: string;
          early_price_cents: number;
          end_date: string;
          enroll_open: boolean;
          id: string;
          is_test: boolean;
          name: string;
          price_cents: number;
          start_date: string;
          stripe_early_price_id: string | null;
          stripe_price_id: string | null;
        };
        Insert: {
          closed_at?: string | null;
          created_at?: string;
          early_price_cents?: number;
          end_date?: never;
          enroll_open?: boolean;
          id?: string;
          is_test?: boolean;
          name: string;
          price_cents?: number;
          start_date: string;
          stripe_early_price_id?: string | null;
          stripe_price_id?: string | null;
        };
        Update: {
          closed_at?: string | null;
          created_at?: string;
          early_price_cents?: number;
          end_date?: never;
          enroll_open?: boolean;
          id?: string;
          is_test?: boolean;
          name?: string;
          price_cents?: number;
          start_date?: string;
          stripe_early_price_id?: string | null;
          stripe_price_id?: string | null;
        };
        Relationships: [];
      };
      day_status: {
        Row: {
          closed_at: string;
          day: string;
          enrollment_id: string;
          opened_app: boolean;
          status: string;
        };
        Insert: {
          closed_at?: string;
          day: string;
          enrollment_id: string;
          opened_app: boolean;
          status: string;
        };
        Update: {
          closed_at?: string;
          day?: string;
          enrollment_id?: string;
          opened_app?: boolean;
          status?: string;
        };
        Relationships: [];
      };
      enrollments: {
        Row: {
          amount_paid_cents: number | null;
          category: string;
          closed_at: string | null;
          cohort_id: string;
          created_at: string;
          goal_public: boolean;
          goal_title: string;
          id: string;
          last_level_up_week: number;
          level: number;
          level_seen: number;
          loyalty_code: string | null;
          paid_at: string | null;
          presale_id: string | null;
          pushups: string;
          stake_cents: number;
          stake_donated_at: string | null;
          stake_payment_intent_id: string | null;
          stake_status: string;
          started_on: string | null;
          status: string;
          stripe_checkout_session_id: string | null;
          user_id: string;
          utm_campaign: string | null;
          utm_source: string | null;
          wake_time: string;
          weak_moments: string[];
        };
        Insert: {
          amount_paid_cents?: number | null;
          category: string;
          closed_at?: string | null;
          cohort_id: string;
          created_at?: string;
          goal_public?: boolean;
          goal_title: string;
          id?: string;
          last_level_up_week?: number;
          level?: number;
          level_seen?: number;
          loyalty_code?: string | null;
          paid_at?: string | null;
          presale_id?: string | null;
          pushups?: string;
          stake_cents?: number;
          stake_donated_at?: string | null;
          stake_payment_intent_id?: string | null;
          stake_status?: string;
          started_on?: string | null;
          status?: string;
          stripe_checkout_session_id?: string | null;
          user_id: string;
          utm_campaign?: string | null;
          utm_source?: string | null;
          wake_time?: string;
          weak_moments?: string[];
        };
        Update: {
          amount_paid_cents?: number | null;
          category?: string;
          closed_at?: string | null;
          cohort_id?: string;
          created_at?: string;
          goal_public?: boolean;
          goal_title?: string;
          id?: string;
          last_level_up_week?: number;
          level?: number;
          level_seen?: number;
          loyalty_code?: string | null;
          paid_at?: string | null;
          presale_id?: string | null;
          pushups?: string;
          stake_cents?: number;
          stake_donated_at?: string | null;
          stake_payment_intent_id?: string | null;
          stake_status?: string;
          started_on?: string | null;
          status?: string;
          stripe_checkout_session_id?: string | null;
          user_id?: string;
          utm_campaign?: string | null;
          utm_source?: string | null;
          wake_time?: string;
          weak_moments?: string[];
        };
        Relationships: [];
      };
      misses: {
        Row: {
          day: string;
          enrollment_id: string;
          points: number;
          principle_id: string;
          streak: number;
          white: boolean;
        };
        Insert: {
          day: string;
          enrollment_id: string;
          points: number;
          principle_id: string;
          streak: number;
          white: boolean;
        };
        Update: {
          day?: string;
          enrollment_id?: string;
          points?: number;
          principle_id?: string;
          streak?: number;
          white?: boolean;
        };
        Relationships: [];
      };
      points_ledger: {
        Row: {
          created_at: string;
          day: string;
          delta: number;
          enrollment_id: string;
          id: number;
          reason: string;
          ref_id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          day: string;
          delta: number;
          enrollment_id: string;
          id?: number;
          reason: string;
          ref_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          day?: string;
          delta?: number;
          enrollment_id?: string;
          id?: number;
          reason?: string;
          ref_id?: string;
          user_id?: string;
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
        Relationships: [];
      };
      principle_templates: {
        Row: {
          categories: string[];
          code: string;
          days: number[];
          difficulty: number;
          if_text: string;
          proof_type: string;
          target: Json;
          then_text: string;
        };
        Insert: {
          categories?: string[];
          code: string;
          days?: number[];
          difficulty: number;
          if_text: string;
          proof_type: string;
          target?: Json;
          then_text: string;
        };
        Update: {
          categories?: string[];
          code?: string;
          days?: number[];
          difficulty?: number;
          if_text?: string;
          proof_type?: string;
          target?: Json;
          then_text?: string;
        };
        Relationships: [];
      };
      principles: {
        Row: {
          created_at: string;
          days: number[];
          difficulty: number;
          enrollment_id: string;
          id: string;
          if_text: string;
          max_difficulty: number;
          position: number;
          proof_type: string;
          source: string;
          target: Json;
          template_code: string | null;
          then_text: string;
        };
        Insert: {
          created_at?: string;
          days?: number[];
          difficulty: number;
          enrollment_id: string;
          id?: string;
          if_text: string;
          max_difficulty: number;
          position: number;
          proof_type: string;
          source: string;
          target?: Json;
          template_code?: string | null;
          then_text: string;
        };
        Update: {
          created_at?: string;
          days?: number[];
          difficulty?: number;
          enrollment_id?: string;
          id?: string;
          if_text?: string;
          max_difficulty?: number;
          position?: number;
          proof_type?: string;
          source?: string;
          target?: Json;
          template_code?: string | null;
          then_text?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          birth_year: number;
          created_at: string;
          email_reminders: boolean;
          id: string;
          is_admin: boolean;
          is_public: boolean;
          profile_art_slug: string | null;
          pseudo: string;
          referral_code: string | null;
          refused_proofs: number;
          stripe_promotion_code_id: string | null;
        };
        Insert: {
          birth_year: number;
          created_at?: string;
          email_reminders?: boolean;
          id: string;
          is_admin?: boolean;
          is_public?: boolean;
          profile_art_slug?: string | null;
          pseudo: string;
          referral_code?: string | null;
          refused_proofs?: number;
          stripe_promotion_code_id?: string | null;
        };
        Update: {
          birth_year?: number;
          created_at?: string;
          email_reminders?: boolean;
          id?: string;
          is_admin?: boolean;
          is_public?: boolean;
          profile_art_slug?: string | null;
          pseudo?: string;
          referral_code?: string | null;
          refused_proofs?: number;
          stripe_promotion_code_id?: string | null;
        };
        Relationships: [];
      };
      proof_sessions: {
        Row: {
          challenge_assignment_id: string | null;
          data: Json;
          day: string;
          ended_at: string | null;
          enrollment_id: string;
          heartbeats: number;
          id: string;
          kind: string;
          last_heartbeat_at: string | null;
          minutes: number | null;
          nonce: string;
          principle_id: string | null;
          started_at: string;
          status: string;
          user_id: string;
        };
        Insert: {
          challenge_assignment_id?: string | null;
          data?: Json;
          day: string;
          ended_at?: string | null;
          enrollment_id: string;
          heartbeats?: number;
          id?: string;
          kind: string;
          last_heartbeat_at?: string | null;
          minutes?: number | null;
          nonce: string;
          principle_id?: string | null;
          started_at?: string;
          status?: string;
          user_id: string;
        };
        Update: {
          challenge_assignment_id?: string | null;
          data?: Json;
          day?: string;
          ended_at?: string | null;
          enrollment_id?: string;
          heartbeats?: number;
          id?: string;
          kind?: string;
          last_heartbeat_at?: string | null;
          minutes?: number | null;
          nonce?: string;
          principle_id?: string | null;
          started_at?: string;
          status?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      push_subscriptions: {
        Row: {
          auth: string;
          created_at: string;
          endpoint: string;
          id: string;
          p256dh: string;
          user_id: string;
        };
        Insert: {
          auth: string;
          created_at?: string;
          endpoint: string;
          id?: string;
          p256dh: string;
          user_id: string;
        };
        Update: {
          auth?: string;
          created_at?: string;
          endpoint?: string;
          id?: string;
          p256dh?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      rate_limits: {
        Row: {
          bucket: string;
          hits: number;
          reset_at: string;
        };
        Insert: {
          bucket: string;
          hits: number;
          reset_at: string;
        };
        Update: {
          bucket?: string;
          hits?: number;
          reset_at?: string;
        };
        Relationships: [];
      };
      referrals: {
        Row: {
          created_at: string;
          enrollment_id: string;
          id: string;
          referrer_id: string;
          stripe_checkout_session_id: string | null;
        };
        Insert: {
          created_at?: string;
          enrollment_id: string;
          id?: string;
          referrer_id: string;
          stripe_checkout_session_id?: string | null;
        };
        Update: {
          created_at?: string;
          enrollment_id?: string;
          id?: string;
          referrer_id?: string;
          stripe_checkout_session_id?: string | null;
        };
        Relationships: [];
      };
      reminder_log: {
        Row: {
          channel: string;
          day: string;
          sent_at: string;
          user_id: string;
        };
        Insert: {
          channel: string;
          day: string;
          sent_at?: string;
          user_id: string;
        };
        Update: {
          channel?: string;
          day?: string;
          sent_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      reports: {
        Row: {
          created_at: string;
          id: string;
          reason: string;
          reported_user_id: string;
          reporter_id: string;
          status: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          reason: string;
          reported_user_id: string;
          reporter_id: string;
          status?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          reason?: string;
          reported_user_id?: string;
          reporter_id?: string;
          status?: string;
        };
        Relationships: [];
      };
      settings: {
        Row: {
          key: string;
          value: Json;
        };
        Insert: {
          key: string;
          value: Json;
        };
        Update: {
          key?: string;
          value?: Json;
        };
        Relationships: [];
      };
      stripe_events: {
        Row: {
          id: string;
          processed_at: string;
          type: string;
        };
        Insert: {
          id: string;
          processed_at?: string;
          type: string;
        };
        Update: {
          id?: string;
          processed_at?: string;
          type?: string;
        };
        Relationships: [];
      };
      user_achievements: {
        Row: {
          achievement_id: string;
          enrollment_id: string;
          seen_at: string | null;
          unlocked_at: string;
          user_id: string;
        };
        Insert: {
          achievement_id: string;
          enrollment_id: string;
          seen_at?: string | null;
          unlocked_at?: string;
          user_id: string;
        };
        Update: {
          achievement_id?: string;
          enrollment_id?: string;
          seen_at?: string | null;
          unlocked_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      validations: {
        Row: {
          created_at: string;
          day: string;
          enrollment_id: string;
          id: string;
          link_url: string | null;
          photo_deleted_at: string | null;
          photo_path: string | null;
          points: number;
          principle_id: string;
          proof_session_id: string | null;
          proof_type: string;
          status: string;
          strength: string;
        };
        Insert: {
          created_at?: string;
          day: string;
          enrollment_id: string;
          id?: string;
          link_url?: string | null;
          photo_deleted_at?: string | null;
          photo_path?: string | null;
          points: number;
          principle_id: string;
          proof_session_id?: string | null;
          proof_type: string;
          status?: string;
          strength: string;
        };
        Update: {
          created_at?: string;
          day?: string;
          enrollment_id?: string;
          id?: string;
          link_url?: string | null;
          photo_deleted_at?: string | null;
          photo_path?: string | null;
          points?: number;
          principle_id?: string;
          proof_session_id?: string | null;
          proof_type?: string;
          status?: string;
          strength?: string;
        };
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
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      abandon_session: { Args: { p_session_id: string | null; p_nonce: string | null }; Returns: Json };
      achievement_rarity: { Args: { p_cohort_id: string | null }; Returns: { code: string; title: string; description: string; points: number; art_slug: string; holders: number; total: number; percent: number }[] };
      activate_paid_enrollment: { Args: { p_enrollment: string | null; p_session_id: string | null; p_amount: number | null; p_promotion_code_id: string | null; p_utm_source: string | null; p_utm_campaign: string | null }; Returns: Json };
      admin_audit_queue: { Args: never; Returns: Json };
      admin_log: { Args: { p_action: string | null; p_target: string | null; p_details: Json | null }; Returns: undefined };
      admin_mark_stake_donated: { Args: { p_enrollment: string | null }; Returns: undefined };
      admin_overview: { Args: never; Returns: Json };
      admin_proof_path: { Args: { p_audit_id: string | null; p_which: string | null }; Returns: string };
      admin_recent_log: { Args: never; Returns: Json };
      admin_reports: { Args: never; Returns: Json };
      admin_resolve_report: { Args: { p_report_id: string | null; p_status: string | null; p_hide_profile: boolean | null }; Returns: undefined };
      admin_review_audit: { Args: { p_audit_id: string | null; p_pass: boolean | null }; Returns: undefined };
      admin_save_cohort: { Args: { p_id: string | null; p_name: string | null; p_start_date: string | null; p_enroll_open: boolean | null; p_price_cents: number | null; p_early_price_cents: number | null; p_is_test: boolean | null }; Returns: string };
      admin_stakes: { Args: never; Returns: Json };
      claim_presale: { Args: never; Returns: boolean };
      cleanup_rate_limits: { Args: never; Returns: undefined };
      close_day: { Args: { p_enrollment: string | null; p_day: string | null }; Returns: string };
      cohort_signups: { Args: { p_cohort_id: string | null }; Returns: number };
      cohort_stats: { Args: { p_cohort_id: string | null }; Returns: { inscrits: number; actifs: number; ont_lache: number; ont_termine: number; verts_aujourdhui: number }[] };
      complete_reps: { Args: { p_session_id: string | null; p_nonce: string | null; p_reps: Json | null }; Returns: Json };
      complete_session: { Args: { p_session_id: string | null; p_nonce: string | null }; Returns: Json };
      complete_wake_check: { Args: { p_session_id: string | null; p_nonce: string | null; p_code: string | null }; Returns: Json };
      create_enrollment: { Args: { p_pseudo: string | null; p_birth_year: number | null; p_is_public: boolean | null; p_adult: boolean | null; p_category: string | null; p_goal_title: string | null; p_goal_public: boolean | null; p_weak_moments: string[] | null; p_wake_time: string | null; p_pushups: string | null; p_cohort_id?: string | null }; Returns: string };
      cron_close_days: { Args: never; Returns: number };
      cron_cohort_end: { Args: never; Returns: Json };
      cron_expire_audits: { Args: never; Returns: number };
      cron_expire_sessions: { Args: never; Returns: number };
      cron_photo_cleanup_targets: { Args: never; Returns: string[] };
      cron_reminder_targets: { Args: never; Returns: { user_id: string; email: string; remaining: number; points: number; email_reminders: boolean; has_push: boolean }[] };
      cron_weekly: { Args: never; Returns: Json };
      day_detail: { Args: { p_day: string | null }; Returns: Json };
      delete_my_account: { Args: never; Returns: string[] };
      delete_push_endpoint: { Args: { p_endpoint: string | null }; Returns: undefined };
      delete_push_subscriptions: { Args: never; Returns: undefined };
      export_my_data: { Args: never; Returns: Json };
      heartbeat: { Args: { p_session_id: string | null; p_nonce: string | null; p_visible: boolean | null; p_hidden_ms: number | null }; Returns: Json };
      leaderboard: { Args: { p_cohort_id: string | null; p_category?: string | null; p_period?: string | null }; Returns: { rank: number; pseudo: string; category: string; points: number; green_days: number; level: number; goal_title: string; is_me: boolean; is_public: boolean }[] };
      mark_achievements_seen: { Args: never; Returns: undefined };
      mark_level_seen: { Args: never; Returns: undefined };
      mark_photos_deleted: { Args: { p_paths: string[] | null }; Returns: undefined };
      mark_reminded: { Args: { p_user: string | null; p_channel: string | null }; Returns: boolean };
      mark_stake: { Args: { p_enrollment: string | null; p_status: string | null }; Returns: undefined };
      my_dashboard: { Args: never; Returns: Json };
      my_profile: { Args: never; Returns: Json };
      new_achievements: { Args: never; Returns: Json };
      paris_now: { Args: never; Returns: string };
      paris_today: { Args: never; Returns: string };
      public_profile: { Args: { p_pseudo: string | null }; Returns: Json };
      push_targets: { Args: { p_user: string | null }; Returns: { endpoint: string; p256dh: string; auth: string }[] };
      rate_limit_hit: { Args: { p_bucket: string | null; p_max: number | null; p_window_seconds: number | null }; Returns: boolean };
      record_stake: { Args: { p_enrollment: string | null; p_payment_intent: string | null; p_amount: number | null }; Returns: boolean };
      remove_custom_principle: { Args: never; Returns: undefined };
      report_user: { Args: { p_pseudo: string | null; p_reason: string | null }; Returns: undefined };
      save_push_subscription: { Args: { p_endpoint: string | null; p_p256dh: string | null; p_auth: string | null }; Returns: undefined };
      set_audit_rate: { Args: { p_rate: number | null }; Returns: undefined };
      set_custom_principle: { Args: { p_if: string | null; p_then: string | null }; Returns: undefined };
      set_loyalty_code: { Args: { p_enrollment: string | null; p_code: string | null }; Returns: undefined };
      set_referral_promo: { Args: { p_user: string | null; p_promotion_code_id: string | null }; Returns: undefined };
      start_challenge_session: { Args: { p_assignment_id: string | null; p_minutes?: number | null }; Returns: Json };
      start_proof_session: { Args: { p_principle_id: string | null }; Returns: Json };
      submit_audit_photo: { Args: { p_user: string | null; p_audit_id: string | null; p_path: string | null }; Returns: undefined };
      update_profile_settings: { Args: { p_is_public: boolean | null; p_art_slug: string | null; p_email_reminders: boolean | null }; Returns: undefined };
      validate_challenge_declaratif: { Args: { p_assignment_id: string | null }; Returns: Json };
      validate_challenge_link: { Args: { p_assignment_id: string | null; p_url: string | null }; Returns: Json };
      validate_challenge_photo: { Args: { p_user: string | null; p_assignment_id: string | null; p_path: string | null }; Returns: Json };
      validate_declaratif: { Args: { p_principle_id: string | null }; Returns: Json };
      validate_link: { Args: { p_principle_id: string | null; p_url: string | null }; Returns: Json };
      validate_photo: { Args: { p_user: string | null; p_principle_id: string | null; p_path: string | null }; Returns: Json };
      weekly_recap_targets: { Args: never; Returns: { user_id: string; email: string; email_reminders: boolean; points: number; green: number; days: number; challenge: string; challenge_status: string; level: number }[] };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
