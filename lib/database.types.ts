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
          wallet_entry_id: string | null;
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
          wallet_entry_id?: string | null;
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
          wallet_entry_id?: string | null;
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
          week: number;
        };
        Insert: {
          challenge_id: string;
          created_at?: string;
          enrollment_id: string;
          evaluated_at?: string | null;
          id?: string;
          status?: string;
          week: number;
        };
        Update: {
          challenge_id?: string;
          created_at?: string;
          enrollment_id?: string;
          evaluated_at?: string | null;
          id?: string;
          status?: string;
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
      email_log: {
        Row: {
          kind: string;
          ref: string;
          sent_at: string;
          user_id: string;
        };
        Insert: {
          kind: string;
          ref: string;
          sent_at?: string;
          user_id: string;
        };
        Update: {
          kind?: string;
          ref?: string;
          sent_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      enrollments: {
        Row: {
          activated_at: string | null;
          after_photo_path: string | null;
          arc_number: number;
          arc_paid: boolean;
          arc_payment: string | null;
          before_photo_path: string | null;
          category: string;
          closed_at: string | null;
          created_at: string;
          end_date: string;
          focus_minutes: number;
          goal_public: boolean;
          goal_target: number | null;
          goal_title: string;
          goal_type: string;
          goal_unit: string | null;
          id: string;
          jokers_used: number;
          loyalty_applied_at: string | null;
          pushups: string;
          start_date: string;
          status: string;
          user_id: string;
          utm_campaign: string | null;
          utm_source: string | null;
          wake_time: string;
          weak_points: string[];
        };
        Insert: {
          activated_at?: string | null;
          after_photo_path?: string | null;
          arc_number?: number;
          arc_paid?: boolean;
          arc_payment?: string | null;
          before_photo_path?: string | null;
          category: string;
          closed_at?: string | null;
          created_at?: string;
          end_date?: never;
          focus_minutes?: number;
          goal_public?: boolean;
          goal_target?: number | null;
          goal_title: string;
          goal_type: string;
          goal_unit?: string | null;
          id?: string;
          jokers_used?: number;
          loyalty_applied_at?: string | null;
          pushups?: string;
          start_date: string;
          status?: string;
          user_id: string;
          utm_campaign?: string | null;
          utm_source?: string | null;
          wake_time?: string;
          weak_points?: string[];
        };
        Update: {
          activated_at?: string | null;
          after_photo_path?: string | null;
          arc_number?: number;
          arc_paid?: boolean;
          arc_payment?: string | null;
          before_photo_path?: string | null;
          category?: string;
          closed_at?: string | null;
          created_at?: string;
          end_date?: never;
          focus_minutes?: number;
          goal_public?: boolean;
          goal_target?: number | null;
          goal_title?: string;
          goal_type?: string;
          goal_unit?: string | null;
          id?: string;
          jokers_used?: number;
          loyalty_applied_at?: string | null;
          pushups?: string;
          start_date?: string;
          status?: string;
          user_id?: string;
          utm_campaign?: string | null;
          utm_source?: string | null;
          wake_time?: string;
          weak_points?: string[];
        };
        Relationships: [];
      };
      joker_days: {
        Row: {
          created_at: string;
          day: string;
          enrollment_id: string;
        };
        Insert: {
          created_at?: string;
          day: string;
          enrollment_id: string;
        };
        Update: {
          created_at?: string;
          day?: string;
          enrollment_id?: string;
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
      payments: {
        Row: {
          amount_cents: number;
          currency: string;
          id: string;
          kind: string;
          paid_at: string;
          plan: string | null;
          plan_interval: string | null;
          stripe_object_id: string;
          user_id: string | null;
          utm_campaign: string | null;
          utm_source: string | null;
        };
        Insert: {
          amount_cents: number;
          currency?: string;
          id?: string;
          kind: string;
          paid_at?: string;
          plan?: string | null;
          plan_interval?: string | null;
          stripe_object_id: string;
          user_id?: string | null;
          utm_campaign?: string | null;
          utm_source?: string | null;
        };
        Update: {
          amount_cents?: number;
          currency?: string;
          id?: string;
          kind?: string;
          paid_at?: string;
          plan?: string | null;
          plan_interval?: string | null;
          stripe_object_id?: string;
          user_id?: string | null;
          utm_campaign?: string | null;
          utm_source?: string | null;
        };
        Relationships: [];
      };
      pending_arcs: {
        Row: {
          answers: Json;
          created_at: string;
          email: string;
          plan: string | null;
          plan_interval: string | null;
        };
        Insert: {
          answers: Json;
          created_at?: string;
          email: string;
          plan?: string | null;
          plan_interval?: string | null;
        };
        Update: {
          answers?: Json;
          created_at?: string;
          email?: string;
          plan?: string | null;
          plan_interval?: string | null;
        };
        Relationships: [];
      };
      player_stats: {
        Row: {
          arcs_completed: number;
          best_streak: number;
          business: number;
          corps: number;
          discipline: number;
          energie: number;
          esprit: number;
          focus: number;
          focus_minutes: number;
          green_days: number;
          level: number;
          level_seen: number;
          ovr: number;
          reps: number;
          streak: number;
          updated_at: string;
          user_id: string;
          wakes: number;
          wallet_declared_cents: number;
          wallet_proven_cents: number;
          xp: number;
        };
        Insert: {
          arcs_completed?: number;
          best_streak?: number;
          business?: number;
          corps?: number;
          discipline?: number;
          energie?: number;
          esprit?: number;
          focus?: number;
          focus_minutes?: number;
          green_days?: number;
          level?: number;
          level_seen?: number;
          ovr?: number;
          reps?: number;
          streak?: number;
          updated_at?: string;
          user_id: string;
          wakes?: number;
          wallet_declared_cents?: number;
          wallet_proven_cents?: number;
          xp?: number;
        };
        Update: {
          arcs_completed?: number;
          best_streak?: number;
          business?: number;
          corps?: number;
          discipline?: number;
          energie?: number;
          esprit?: number;
          focus?: number;
          focus_minutes?: number;
          green_days?: number;
          level?: number;
          level_seen?: number;
          ovr?: number;
          reps?: number;
          streak?: number;
          updated_at?: string;
          user_id?: string;
          wakes?: number;
          wallet_declared_cents?: number;
          wallet_proven_cents?: number;
          xp?: number;
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
      principle_templates: {
        Row: {
          categories: string[];
          code: string;
          days: number[];
          difficulty: number;
          goal_types: string[];
          if_text: string;
          pillar: string;
          proof_type: string;
          sort: number;
          source: string;
          target: Json;
          then_text: string;
          weak_points: string[];
          why: string;
        };
        Insert: {
          categories?: string[];
          code: string;
          days?: number[];
          difficulty?: number;
          goal_types?: string[];
          if_text: string;
          pillar: string;
          proof_type: string;
          sort?: number;
          source: string;
          target?: Json;
          then_text: string;
          weak_points?: string[];
          why: string;
        };
        Update: {
          categories?: string[];
          code?: string;
          days?: number[];
          difficulty?: number;
          goal_types?: string[];
          if_text?: string;
          pillar?: string;
          proof_type?: string;
          sort?: number;
          source?: string;
          target?: Json;
          then_text?: string;
          weak_points?: string[];
          why?: string;
        };
        Relationships: [];
      };
      principles: {
        Row: {
          active_from: string;
          active_until: string | null;
          created_at: string;
          days: number[];
          difficulty: number;
          enrollment_id: string;
          id: string;
          if_text: string;
          pillar: string;
          position: number;
          proof_type: string;
          source: string;
          target: Json;
          template_code: string | null;
          then_text: string;
          why: string | null;
        };
        Insert: {
          active_from: string;
          active_until?: string | null;
          created_at?: string;
          days: number[];
          difficulty: number;
          enrollment_id: string;
          id?: string;
          if_text: string;
          pillar: string;
          position: number;
          proof_type: string;
          source: string;
          target?: Json;
          template_code?: string | null;
          then_text: string;
          why?: string | null;
        };
        Update: {
          active_from?: string;
          active_until?: string | null;
          created_at?: string;
          days?: number[];
          difficulty?: number;
          enrollment_id?: string;
          id?: string;
          if_text?: string;
          pillar?: string;
          position?: number;
          proof_type?: string;
          source?: string;
          target?: Json;
          template_code?: string | null;
          then_text?: string;
          why?: string | null;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          arc_credits: number;
          avatar_path: string | null;
          bio: string | null;
          birth_year: number;
          cancel_at_period_end: boolean;
          comp_plan: string | null;
          comp_until: string | null;
          created_at: string;
          current_period_end: string | null;
          email_reminders: boolean;
          id: string;
          is_admin: boolean;
          is_public: boolean;
          loyalty_pending: boolean;
          plan: string | null;
          plan_interval: string | null;
          plan_status: string | null;
          profile_art_slug: string | null;
          pseudo: string;
          referral_code: string | null;
          referral_rewards: number;
          refused_proofs: number;
          stripe_customer_id: string | null;
          stripe_promotion_code_id: string | null;
          stripe_subscription_id: string | null;
          utm_campaign: string | null;
          utm_source: string | null;
          wallet_public: boolean;
        };
        Insert: {
          arc_credits?: number;
          avatar_path?: string | null;
          bio?: string | null;
          birth_year: number;
          cancel_at_period_end?: boolean;
          comp_plan?: string | null;
          comp_until?: string | null;
          created_at?: string;
          current_period_end?: string | null;
          email_reminders?: boolean;
          id: string;
          is_admin?: boolean;
          is_public?: boolean;
          loyalty_pending?: boolean;
          plan?: string | null;
          plan_interval?: string | null;
          plan_status?: string | null;
          profile_art_slug?: string | null;
          pseudo: string;
          referral_code?: string | null;
          referral_rewards?: number;
          refused_proofs?: number;
          stripe_customer_id?: string | null;
          stripe_promotion_code_id?: string | null;
          stripe_subscription_id?: string | null;
          utm_campaign?: string | null;
          utm_source?: string | null;
          wallet_public?: boolean;
        };
        Update: {
          arc_credits?: number;
          avatar_path?: string | null;
          bio?: string | null;
          birth_year?: number;
          cancel_at_period_end?: boolean;
          comp_plan?: string | null;
          comp_until?: string | null;
          created_at?: string;
          current_period_end?: string | null;
          email_reminders?: boolean;
          id?: string;
          is_admin?: boolean;
          is_public?: boolean;
          loyalty_pending?: boolean;
          plan?: string | null;
          plan_interval?: string | null;
          plan_status?: string | null;
          profile_art_slug?: string | null;
          pseudo?: string;
          referral_code?: string | null;
          referral_rewards?: number;
          refused_proofs?: number;
          stripe_customer_id?: string | null;
          stripe_promotion_code_id?: string | null;
          stripe_subscription_id?: string | null;
          utm_campaign?: string | null;
          utm_source?: string | null;
          wallet_public?: boolean;
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
          id: string;
          referred_id: string;
          referrer_id: string;
          reward_cents: number;
          rewarded_at: string | null;
          stripe_object_id: string | null;
        };
        Insert: {
          created_at?: string;
          id?: string;
          referred_id: string;
          referrer_id: string;
          reward_cents?: number;
          rewarded_at?: string | null;
          stripe_object_id?: string | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          referred_id?: string;
          referrer_id?: string;
          reward_cents?: number;
          rewarded_at?: string | null;
          stripe_object_id?: string | null;
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
      squad_members: {
        Row: {
          joined_at: string;
          squad_id: string;
          user_id: string;
        };
        Insert: {
          joined_at?: string;
          squad_id: string;
          user_id: string;
        };
        Update: {
          joined_at?: string;
          squad_id?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      squads: {
        Row: {
          code: string;
          created_at: string;
          description: string | null;
          id: string;
          is_official: boolean;
          is_public: boolean;
          name: string;
          owner_id: string | null;
          start_date: string | null;
        };
        Insert: {
          code: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          is_official?: boolean;
          is_public?: boolean;
          name: string;
          owner_id?: string | null;
          start_date?: string | null;
        };
        Update: {
          code?: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          is_official?: boolean;
          is_public?: boolean;
          name?: string;
          owner_id?: string | null;
          start_date?: string | null;
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
          enrollment_id: string | null;
          seen_at: string | null;
          unlocked_at: string;
          user_id: string;
        };
        Insert: {
          achievement_id: string;
          enrollment_id?: string | null;
          seen_at?: string | null;
          unlocked_at?: string;
          user_id: string;
        };
        Update: {
          achievement_id?: string;
          enrollment_id?: string | null;
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
          pillar: string;
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
          pillar: string;
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
          pillar?: string;
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
          created_at: string;
          email: string;
          id: string;
          utm_campaign: string | null;
          utm_source: string | null;
        };
        Insert: {
          created_at?: string;
          email: string;
          id?: string;
          utm_campaign?: string | null;
          utm_source?: string | null;
        };
        Update: {
          created_at?: string;
          email?: string;
          id?: string;
          utm_campaign?: string | null;
          utm_source?: string | null;
        };
        Relationships: [];
      };
      wallet_entries: {
        Row: {
          amount_cents: number;
          created_at: string;
          day: string;
          enrollment_id: string | null;
          id: string;
          label: string;
          proof_deleted_at: string | null;
          proof_path: string | null;
          source: string;
          status: string;
          user_id: string;
        };
        Insert: {
          amount_cents: number;
          created_at?: string;
          day: string;
          enrollment_id?: string | null;
          id?: string;
          label: string;
          proof_deleted_at?: string | null;
          proof_path?: string | null;
          source: string;
          status?: string;
          user_id: string;
        };
        Update: {
          amount_cents?: number;
          created_at?: string;
          day?: string;
          enrollment_id?: string | null;
          id?: string;
          label?: string;
          proof_deleted_at?: string | null;
          proof_path?: string | null;
          source?: string;
          status?: string;
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      abandon_session: { Args: { p_session_id: string | null; p_nonce: string | null }; Returns: Json };
      achievement_rarity: { Args: never; Returns: { code: string; title: string; description: string; points: number; art_slug: string; holders: number; total: number; percent: number }[] };
      activate_my_arc: { Args: never; Returns: boolean };
      add_referral_reward: { Args: { p_user: string | null }; Returns: undefined };
      add_template_principle: { Args: { p_code: string | null }; Returns: string };
      add_wallet_entry: { Args: { p_user: string | null; p_amount_cents: number | null; p_source: string | null; p_label: string | null; p_day: string | null; p_proof_path: string | null }; Returns: Json };
      admin_audit_queue: { Args: never; Returns: Json };
      admin_grant_comp: { Args: { p_pseudo: string | null; p_plan: string | null; p_until: string | null }; Returns: undefined };
      admin_log: { Args: { p_action: string | null; p_target: string | null; p_details: Json | null }; Returns: undefined };
      admin_overview: { Args: never; Returns: Json };
      admin_proof_path: { Args: { p_audit_id: string | null; p_which: string | null }; Returns: string };
      admin_recent_log: { Args: never; Returns: Json };
      admin_reports: { Args: never; Returns: Json };
      admin_resolve_report: { Args: { p_report_id: string | null; p_status: string | null; p_hide_profile: boolean | null }; Returns: undefined };
      admin_review_audit: { Args: { p_audit_id: string | null; p_pass: boolean | null }; Returns: undefined };
      admin_save_squad: { Args: { p_id: string | null; p_name: string | null; p_description: string | null; p_start_date: string | null; p_is_public: boolean | null }; Returns: string };
      admin_squads: { Args: never; Returns: Json };
      billing_profile: { Args: { p_user: string | null }; Returns: Json };
      cleanup_rate_limits: { Args: never; Returns: undefined };
      close_day: { Args: { p_enrollment: string | null; p_day: string | null }; Returns: string };
      collective_starts: { Args: never; Returns: Json };
      complete_reps: { Args: { p_session_id: string | null; p_nonce: string | null; p_reps: Json | null }; Returns: Json };
      complete_session: { Args: { p_session_id: string | null; p_nonce: string | null }; Returns: Json };
      complete_wake_check: { Args: { p_session_id: string | null; p_nonce: string | null; p_code: string | null }; Returns: Json };
      create_squad: { Args: { p_name: string | null; p_description: string | null; p_is_public: boolean | null }; Returns: string };
      cron_arc_results: { Args: never; Returns: { enrollment_id: string; user_id: string; email: string; status: string; green: number; arc_number: number }[] };
      cron_close_days: { Args: never; Returns: number };
      cron_expire_audits: { Args: never; Returns: number };
      cron_expire_sessions: { Args: never; Returns: number };
      cron_loyalty_targets: { Args: never; Returns: { enrollment_id: string; user_id: string; email: string; subscription_id: string; plan: string }[] };
      cron_photo_cleanup_targets: { Args: never; Returns: string[] };
      cron_reminder_targets: { Args: never; Returns: { user_id: string; email: string; remaining: number; points: number; email_reminders: boolean; has_push: boolean }[] };
      day_detail: { Args: { p_day: string | null }; Returns: Json };
      delete_my_account: { Args: never; Returns: Json };
      delete_push_endpoint: { Args: { p_endpoint: string | null }; Returns: undefined };
      delete_push_subscriptions: { Args: never; Returns: undefined };
      delete_wallet_entry: { Args: { p_id: string | null }; Returns: undefined };
      export_my_data: { Args: never; Returns: Json };
      global_stats: { Args: never; Returns: { joueurs: number; arcs_en_cours: number; verts_aujourdhui: number; ont_lache: number; arcs_tenus: number }[] };
      grant_arc_pass: { Args: { p_user: string | null; p_object_id: string | null; p_amount: number | null; p_currency: string | null; p_customer: string | null; p_loyalty?: boolean | null; p_referral?: boolean | null }; Returns: boolean };
      grant_lifetime: { Args: { p_user: string | null; p_customer: string | null }; Returns: undefined };
      heartbeat: { Args: { p_session_id: string | null; p_nonce: string | null; p_visible: boolean | null; p_hidden_ms: number | null }; Returns: Json };
      join_public_squad: { Args: { p_id: string | null }; Returns: undefined };
      join_squad: { Args: { p_code: string | null }; Returns: string };
      leaderboard: { Args: { p_period?: string | null; p_category?: string | null; p_squad?: string | null }; Returns: { rank: number; pseudo: string; avatar_path: string; level: number; ovr: number; category: string; points: number; streak: number; is_me: boolean; is_public: boolean }[] };
      leave_squad: { Args: { p_id: string | null }; Returns: undefined };
      log_email_once: { Args: { p_user: string | null; p_kind: string | null; p_ref: string | null }; Returns: boolean };
      mark_achievements_seen: { Args: never; Returns: undefined };
      mark_level_seen: { Args: never; Returns: undefined };
      mark_loyalty_applied: { Args: { p_enrollment: string | null; p_pending?: boolean | null }; Returns: undefined };
      mark_photos_deleted: { Args: { p_paths: string[] | null }; Returns: undefined };
      mark_referral_rewarded: { Args: { p_referred: string | null; p_cents: number | null }; Returns: undefined };
      mark_reminded: { Args: { p_user: string | null; p_channel: string | null }; Returns: boolean };
      my_arc_photos: { Args: never; Returns: Json };
      my_dashboard: { Args: never; Returns: Json };
      my_plan: { Args: never; Returns: Json };
      my_principles: { Args: never; Returns: Json };
      my_profile: { Args: never; Returns: Json };
      my_squads: { Args: never; Returns: Json };
      my_wallet: { Args: never; Returns: Json };
      new_achievements: { Args: never; Returns: Json };
      paris_now: { Args: never; Returns: string };
      paris_today: { Args: never; Returns: string };
      plan_price: { Args: { p_plan: string | null; p_interval: string | null }; Returns: Json };
      plans_public: { Args: never; Returns: Json };
      preview_principles: { Args: { p_category: string | null; p_goal_type: string | null; p_weak_points: string[] | null; p_wake_time: string | null; p_pushups: string | null; p_focus_minutes: number | null }; Returns: Json };
      public_profile: { Args: { p_pseudo: string | null }; Returns: Json };
      public_squads: { Args: never; Returns: Json };
      push_targets: { Args: { p_user: string | null }; Returns: { endpoint: string; p256dh: string; auth: string }[] };
      rate_limit_hit: { Args: { p_bucket: string | null; p_max: number | null; p_window_seconds: number | null }; Returns: boolean };
      record_payment: { Args: { p_object_id: string | null; p_user: string | null; p_kind: string | null; p_plan: string | null; p_interval: string | null; p_amount: number | null; p_currency: string | null }; Returns: boolean };
      record_referral: { Args: { p_promotion_code_id: string | null; p_referred: string | null; p_object_id: string | null }; Returns: Json };
      referral_promo_for: { Args: { p_user: string | null; p_code: string | null }; Returns: Json };
      regenerate_principles: { Args: never; Returns: undefined };
      remove_principle: { Args: { p_id: string | null }; Returns: undefined };
      report_user: { Args: { p_pseudo: string | null; p_reason: string | null }; Returns: undefined };
      save_arc: { Args: { p_category: string | null; p_goal_type: string | null; p_goal_title: string | null; p_goal_target: number | null; p_goal_unit: string | null; p_goal_public: boolean | null; p_weak_points: string[] | null; p_wake_time: string | null; p_pushups: string | null; p_focus_minutes: number | null; p_start_date: string | null; p_squad_id?: string | null }; Returns: string };
      save_principle: { Args: { p_id: string | null; p_pillar: string | null; p_if: string | null; p_then: string | null; p_proof_type: string | null; p_target: Json | null; p_days: number[] | null; p_difficulty?: number | null }; Returns: string };
      save_profile: { Args: { p_pseudo: string | null; p_birth_year: number | null; p_adult: boolean | null; p_is_public: boolean | null; p_utm_source?: string | null; p_utm_campaign?: string | null }; Returns: undefined };
      save_push_subscription: { Args: { p_endpoint: string | null; p_p256dh: string | null; p_auth: string | null }; Returns: undefined };
      set_arc_photo: { Args: { p_user: string | null; p_which: string | null; p_path: string | null }; Returns: string };
      set_audit_rate: { Args: { p_rate: number | null }; Returns: undefined };
      set_avatar: { Args: { p_user: string | null; p_path: string | null }; Returns: string };
      set_referral_promo: { Args: { p_user: string | null; p_promotion_code_id: string | null }; Returns: undefined };
      set_start_date: { Args: { p_date: string | null }; Returns: undefined };
      set_stripe_customer: { Args: { p_user: string | null; p_customer: string | null }; Returns: undefined };
      social_proof: { Args: never; Returns: Json };
      squad_detail: { Args: { p_id: string | null }; Returns: Json };
      start_challenge_session: { Args: { p_assignment_id: string | null; p_minutes?: number | null }; Returns: Json };
      start_proof_session: { Args: { p_principle_id: string | null }; Returns: Json };
      submit_audit_photo: { Args: { p_user: string | null; p_audit_id: string | null; p_path: string | null }; Returns: undefined };
      sync_subscription: { Args: { p_user: string | null; p_customer: string | null; p_subscription: string | null; p_plan: string | null; p_interval: string | null; p_status: string | null; p_period_end: string | null; p_cancel_at_period_end: boolean | null }; Returns: string };
      update_profile_settings: { Args: { p_is_public: boolean | null; p_art_slug: string | null; p_email_reminders: boolean | null; p_wallet_public: boolean | null; p_bio: string | null }; Returns: undefined };
      use_joker: { Args: never; Returns: Json };
      validate_challenge_declaratif: { Args: { p_assignment_id: string | null }; Returns: Json };
      validate_challenge_link: { Args: { p_assignment_id: string | null; p_url: string | null }; Returns: Json };
      validate_challenge_photo: { Args: { p_user: string | null; p_assignment_id: string | null; p_path: string | null }; Returns: Json };
      validate_declaratif: { Args: { p_principle_id: string | null }; Returns: Json };
      validate_link: { Args: { p_principle_id: string | null; p_url: string | null }; Returns: Json };
      validate_photo: { Args: { p_user: string | null; p_principle_id: string | null; p_path: string | null }; Returns: Json };
      weekly_recap_targets: { Args: never; Returns: { user_id: string; email: string; email_reminders: boolean; points: number; green: number; days: number; streak: number; level: number; ovr: number }[] };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
