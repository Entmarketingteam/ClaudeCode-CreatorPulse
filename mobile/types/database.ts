// Creator Pulse - Database Type Definitions
// Auto-generated from Supabase schema

export type PlatformType = 'amazon' | 'ltk' | 'shopmy' | 'mavely';
export type SubscriptionStatus = 'free' | 'trial' | 'active' | 'cancelled' | 'expired';
export type ContentSource = 'instagram' | 'tiktok' | 'youtube' | 'manual';
export type VisualFormat = 'talking_head' | 'voiceover' | 'product_only' | 'lifestyle' | 'tutorial' | 'unboxing' | 'haul' | 'grwm' | 'review';
export type HookStrategy = 'question' | 'statement' | 'controversy' | 'teaser' | 'direct' | 'story' | 'transformation';
export type ProductionStyle = 'polished' | 'raw' | 'mixed';
export type CredentialStatus = 'active' | 'expired' | 'needs_2fa' | 'invalid';

export interface User {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  subscription_status: SubscriptionStatus;
  subscription_expires_at: string | null;
  timezone: string;
  created_at: string;
  updated_at: string;
}

export interface PlatformCredential {
  id: string;
  user_id: string;
  platform: PlatformType;
  encrypted_cookies: string | null;
  encrypted_api_key: string | null;
  status: CredentialStatus;
  last_sync_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContentMaster {
  id: string;
  user_id: string;
  source: ContentSource;
  source_id: string | null;
  url: string;
  thumbnail_url: string | null;
  caption: string | null;
  hashtags: string[] | null;
  posted_at: string | null;
  view_count: number;
  like_count: number;
  comment_count: number;
  share_count: number;
  save_count: number;
  duration_seconds: number | null;
  is_analyzed: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreativeAttributes {
  id: string;
  content_id: string;
  visual_format: VisualFormat | null;
  hook_strategy: HookStrategy | null;
  hook_text: string | null;
  production_style: ProductionStyle | null;
  has_text_overlay: boolean;
  has_music: boolean;
  has_voiceover: boolean;
  has_face_visible: boolean;
  lighting_quality: number | null;
  audio_quality: number | null;
  pacing_score: number | null;
  product_visibility_score: number | null;
  cta_present: boolean;
  cta_type: string | null;
  primary_colors: string[] | null;
  scene_count: number | null;
  ai_confidence_score: number | null;
  raw_analysis: Record<string, unknown> | null;
  analyzed_at: string;
  created_at: string;
}

export interface RevenueEvent {
  id: string;
  user_id: string;
  platform: PlatformType;
  attributed_content_id: string | null;
  order_id: string | null;
  product_name: string | null;
  product_asin: string | null;
  product_category: string | null;
  quantity: number;
  order_amount: number;
  commission_amount: number;
  commission_rate: number | null;
  currency: string;
  order_date: string | null;
  click_date: string | null;
  tracking_id: string | null;
  is_returned: boolean;
  raw_data: Record<string, unknown> | null;
  created_at: string;
}

export interface DailyRevenueSummary {
  id: string;
  user_id: string;
  date: string;
  platform: PlatformType;
  total_orders: number;
  total_order_amount: number;
  total_commission: number;
  avg_commission_rate: number | null;
  top_product: string | null;
  top_product_commission: number | null;
  created_at: string;
  updated_at: string;
}

export interface ContentRevenueAttribution {
  id: string;
  content_id: string;
  revenue_event_id: string;
  attribution_confidence: number | null;
  attribution_method: string | null;
  created_at: string;
}

export interface SyncJob {
  id: string;
  user_id: string;
  platform: PlatformType | null;
  job_type: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  started_at: string | null;
  completed_at: string | null;
  records_processed: number;
  error_message: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

// Extended types with computed fields
export interface ContentWithRevenue extends ContentMaster {
  creative_attributes: CreativeAttributes | null;
  total_revenue: number;
  epc: number; // Earnings Per View (revenue / views)
  attributed_orders: number;
}

export interface PlatformSummary {
  platform: PlatformType;
  total_revenue: number;
  total_orders: number;
  avg_order_value: number;
  top_product: string | null;
  last_sync: string | null;
  credential_status: CredentialStatus;
}

// Database schema types for Supabase client
export interface Database {
  public: {
    Tables: {
      users: {
        Row: User;
        Insert: Omit<User, 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<User, 'id'>>;
      };
      platform_credentials: {
        Row: PlatformCredential;
        Insert: Omit<PlatformCredential, 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<PlatformCredential, 'id'>>;
      };
      content_master: {
        Row: ContentMaster;
        Insert: Omit<ContentMaster, 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<ContentMaster, 'id'>>;
      };
      creative_attributes: {
        Row: CreativeAttributes;
        Insert: Omit<CreativeAttributes, 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<CreativeAttributes, 'id'>>;
      };
      revenue_events: {
        Row: RevenueEvent;
        Insert: Omit<RevenueEvent, 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<RevenueEvent, 'id'>>;
      };
      daily_revenue_summary: {
        Row: DailyRevenueSummary;
        Insert: Omit<DailyRevenueSummary, 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<DailyRevenueSummary, 'id'>>;
      };
      content_revenue_attribution: {
        Row: ContentRevenueAttribution;
        Insert: Omit<ContentRevenueAttribution, 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<ContentRevenueAttribution, 'id'>>;
      };
      sync_jobs: {
        Row: SyncJob;
        Insert: Omit<SyncJob, 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<SyncJob, 'id'>>;
      };
    };
    Functions: {
      calculate_content_epc: {
        Args: { content_uuid: string };
        Returns: number;
      };
      refresh_daily_summary: {
        Args: { target_user_id: string; target_date: string };
        Returns: void;
      };
    };
  };
}
