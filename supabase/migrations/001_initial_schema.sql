-- Creator Pulse MVP Database Schema
-- Initial migration for all core tables

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enum types
CREATE TYPE platform_type AS ENUM ('amazon', 'ltk', 'shopmy', 'mavely');
CREATE TYPE subscription_status AS ENUM ('free', 'trial', 'active', 'cancelled', 'expired');
CREATE TYPE content_source AS ENUM ('instagram', 'tiktok', 'youtube', 'manual');
CREATE TYPE visual_format AS ENUM ('talking_head', 'voiceover', 'product_only', 'lifestyle', 'tutorial', 'unboxing', 'haul', 'grwm', 'review');
CREATE TYPE hook_strategy AS ENUM ('question', 'statement', 'controversy', 'teaser', 'direct', 'story', 'transformation');
CREATE TYPE production_style AS ENUM ('polished', 'raw', 'mixed');
CREATE TYPE credential_status AS ENUM ('active', 'expired', 'needs_2fa', 'invalid');

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    subscription_status subscription_status DEFAULT 'free',
    subscription_expires_at TIMESTAMPTZ,
    timezone TEXT DEFAULT 'America/New_York',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Platform Credentials table (encrypted storage)
CREATE TABLE platform_credentials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    platform platform_type NOT NULL,
    encrypted_cookies TEXT, -- AES-256 encrypted
    encrypted_api_key TEXT, -- For platforms with API access
    status credential_status DEFAULT 'active',
    last_sync_at TIMESTAMPTZ,
    last_error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, platform)
);

-- Content Master table
CREATE TABLE content_master (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    source content_source NOT NULL,
    source_id TEXT, -- Platform-specific ID (Instagram post ID, TikTok video ID)
    url TEXT NOT NULL,
    thumbnail_url TEXT,
    caption TEXT,
    hashtags TEXT[], -- Array of hashtags
    posted_at TIMESTAMPTZ,
    view_count INTEGER DEFAULT 0,
    like_count INTEGER DEFAULT 0,
    comment_count INTEGER DEFAULT 0,
    share_count INTEGER DEFAULT 0,
    save_count INTEGER DEFAULT 0,
    duration_seconds INTEGER,
    is_analyzed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Creative Attributes table (AI analysis results)
CREATE TABLE creative_attributes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    content_id UUID NOT NULL REFERENCES content_master(id) ON DELETE CASCADE,
    visual_format visual_format,
    hook_strategy hook_strategy,
    hook_text TEXT, -- First few words of the hook
    production_style production_style,
    has_text_overlay BOOLEAN DEFAULT FALSE,
    has_music BOOLEAN DEFAULT FALSE,
    has_voiceover BOOLEAN DEFAULT FALSE,
    has_face_visible BOOLEAN DEFAULT FALSE,
    lighting_quality INTEGER CHECK (lighting_quality >= 1 AND lighting_quality <= 5),
    audio_quality INTEGER CHECK (audio_quality >= 1 AND audio_quality <= 5),
    pacing_score INTEGER CHECK (pacing_score >= 1 AND pacing_score <= 5),
    product_visibility_score INTEGER CHECK (product_visibility_score >= 1 AND product_visibility_score <= 5),
    cta_present BOOLEAN DEFAULT FALSE,
    cta_type TEXT, -- 'link_in_bio', 'swipe_up', 'comment', 'shop_now'
    primary_colors TEXT[], -- Dominant colors in the video
    scene_count INTEGER,
    ai_confidence_score DECIMAL(3,2), -- 0.00 to 1.00
    raw_analysis JSONB, -- Full AI response for debugging
    analyzed_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Revenue Events table
CREATE TABLE revenue_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    platform platform_type NOT NULL,
    attributed_content_id UUID REFERENCES content_master(id) ON DELETE SET NULL,
    order_id TEXT, -- Platform's order ID
    product_name TEXT,
    product_asin TEXT, -- Amazon ASIN or similar identifier
    product_category TEXT,
    quantity INTEGER DEFAULT 1,
    order_amount DECIMAL(10,2), -- Total order value
    commission_amount DECIMAL(10,2), -- Your earnings
    commission_rate DECIMAL(5,4), -- As decimal (0.0450 = 4.5%)
    currency TEXT DEFAULT 'USD',
    order_date TIMESTAMPTZ,
    click_date TIMESTAMPTZ, -- When the affiliate link was clicked
    tracking_id TEXT, -- Your affiliate tracking ID
    is_returned BOOLEAN DEFAULT FALSE,
    raw_data JSONB, -- Original row from CSV/API
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(platform, order_id) -- Prevent duplicate imports
);

-- Daily Revenue Summary (materialized for performance)
CREATE TABLE daily_revenue_summary (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    platform platform_type NOT NULL,
    total_orders INTEGER DEFAULT 0,
    total_order_amount DECIMAL(12,2) DEFAULT 0,
    total_commission DECIMAL(12,2) DEFAULT 0,
    avg_commission_rate DECIMAL(5,4),
    top_product TEXT,
    top_product_commission DECIMAL(10,2),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, date, platform)
);

-- Content Revenue Attribution (linking content to revenue)
CREATE TABLE content_revenue_attribution (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    content_id UUID NOT NULL REFERENCES content_master(id) ON DELETE CASCADE,
    revenue_event_id UUID NOT NULL REFERENCES revenue_events(id) ON DELETE CASCADE,
    attribution_confidence DECIMAL(3,2), -- 0.00 to 1.00
    attribution_method TEXT, -- 'direct_link', 'time_window', 'tracking_id', 'fuzzy_match'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(content_id, revenue_event_id)
);

-- Sync Jobs table (tracking automation runs)
CREATE TABLE sync_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    platform platform_type,
    job_type TEXT NOT NULL, -- 'revenue_sync', 'content_analysis', 'attribution'
    status TEXT DEFAULT 'pending', -- 'pending', 'running', 'completed', 'failed'
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    records_processed INTEGER DEFAULT 0,
    error_message TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_platform_credentials_user ON platform_credentials(user_id);
CREATE INDEX idx_content_master_user ON content_master(user_id);
CREATE INDEX idx_content_master_posted_at ON content_master(posted_at DESC);
CREATE INDEX idx_creative_attributes_content ON creative_attributes(content_id);
CREATE INDEX idx_revenue_events_user ON revenue_events(user_id);
CREATE INDEX idx_revenue_events_date ON revenue_events(order_date DESC);
CREATE INDEX idx_revenue_events_platform ON revenue_events(platform);
CREATE INDEX idx_revenue_events_attributed ON revenue_events(attributed_content_id) WHERE attributed_content_id IS NOT NULL;
CREATE INDEX idx_daily_summary_user_date ON daily_revenue_summary(user_id, date DESC);
CREATE INDEX idx_sync_jobs_user ON sync_jobs(user_id);
CREATE INDEX idx_sync_jobs_status ON sync_jobs(status) WHERE status IN ('pending', 'running');

-- Row Level Security Policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE creative_attributes ENABLE ROW LEVEL SECURITY;
ALTER TABLE revenue_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_revenue_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_revenue_attribution ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_jobs ENABLE ROW LEVEL SECURITY;

-- Users can only see their own data
CREATE POLICY "Users can view own profile" ON users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON users
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can view own credentials" ON platform_credentials
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own content" ON content_master
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view own creative attributes" ON creative_attributes
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM content_master
            WHERE content_master.id = creative_attributes.content_id
            AND content_master.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can view own revenue" ON revenue_events
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view own daily summary" ON daily_revenue_summary
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view own attributions" ON content_revenue_attribution
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM content_master
            WHERE content_master.id = content_revenue_attribution.content_id
            AND content_master.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can view own sync jobs" ON sync_jobs
    FOR SELECT USING (auth.uid() = user_id);

-- Functions
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_platform_credentials_updated_at
    BEFORE UPDATE ON platform_credentials
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_content_master_updated_at
    BEFORE UPDATE ON content_master
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_daily_summary_updated_at
    BEFORE UPDATE ON daily_revenue_summary
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Function to calculate EPC (Earnings Per Click/View)
CREATE OR REPLACE FUNCTION calculate_content_epc(content_uuid UUID)
RETURNS DECIMAL(10,4) AS $$
DECLARE
    total_revenue DECIMAL(12,2);
    total_views INTEGER;
BEGIN
    SELECT COALESCE(SUM(re.commission_amount), 0)
    INTO total_revenue
    FROM revenue_events re
    WHERE re.attributed_content_id = content_uuid;

    SELECT COALESCE(view_count, 0)
    INTO total_views
    FROM content_master
    WHERE id = content_uuid;

    IF total_views = 0 THEN
        RETURN 0;
    END IF;

    RETURN total_revenue / total_views;
END;
$$ LANGUAGE plpgsql;

-- Function to refresh daily summary
CREATE OR REPLACE FUNCTION refresh_daily_summary(target_user_id UUID, target_date DATE)
RETURNS VOID AS $$
BEGIN
    INSERT INTO daily_revenue_summary (user_id, date, platform, total_orders, total_order_amount, total_commission, avg_commission_rate, top_product, top_product_commission)
    SELECT
        user_id,
        DATE(order_date) as date,
        platform,
        COUNT(*) as total_orders,
        SUM(order_amount) as total_order_amount,
        SUM(commission_amount) as total_commission,
        AVG(commission_rate) as avg_commission_rate,
        (SELECT product_name FROM revenue_events re2
         WHERE re2.user_id = target_user_id
         AND DATE(re2.order_date) = target_date
         AND re2.platform = revenue_events.platform
         ORDER BY commission_amount DESC LIMIT 1) as top_product,
        MAX(commission_amount) as top_product_commission
    FROM revenue_events
    WHERE user_id = target_user_id
    AND DATE(order_date) = target_date
    GROUP BY user_id, DATE(order_date), platform
    ON CONFLICT (user_id, date, platform)
    DO UPDATE SET
        total_orders = EXCLUDED.total_orders,
        total_order_amount = EXCLUDED.total_order_amount,
        total_commission = EXCLUDED.total_commission,
        avg_commission_rate = EXCLUDED.avg_commission_rate,
        top_product = EXCLUDED.top_product,
        top_product_commission = EXCLUDED.top_product_commission,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;
