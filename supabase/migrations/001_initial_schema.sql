-- CreatorPulse Database Schema
-- Supabase/Postgres with Row Level Security

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- TABLES
-- =============================================================================

-- Accounts (multi-tenant root)
CREATE TABLE accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'enterprise')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Creators (influencers/content creators)
CREATE TABLE creators (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    display_name TEXT NOT NULL,
    ltk_username TEXT,
    ig_user_id TEXT,
    tiktok_username TEXT,
    amazon_storefront_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(account_id, ltk_username),
    UNIQUE(account_id, ig_user_id),
    UNIQUE(account_id, tiktok_username)
);

-- Connections (API/platform credentials)
CREATE TABLE connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    creator_id UUID REFERENCES creators(id) ON DELETE CASCADE,
    provider TEXT NOT NULL CHECK (provider IN (
        'LTK',
        'IG_EXPLORER',
        'IG_GRAPH_API',
        'TIKTOK_PUBLIC',
        'TIKTOK_SHOP',
        'AMAZON_PAAPI',
        'AMAZON_ASSOCIATES'
    )),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN (
        'active',
        'expired',
        'needs_login',
        'revoked',
        'error'
    )),
    -- Encrypted secrets (tokens, cookies, API keys)
    secrets JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    last_refreshed TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(account_id, creator_id, provider)
);

-- Posts (ingested content from various platforms)
CREATE TABLE posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    creator_id UUID NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
    source TEXT NOT NULL CHECK (source IN ('ltk', 'instagram', 'tiktok', 'amazon')),
    source_post_id TEXT NOT NULL,
    caption TEXT,
    media_urls TEXT[] DEFAULT '{}',
    media_type TEXT CHECK (media_type IN ('image', 'video', 'carousel', 'reel', 'story')),
    permalink TEXT,
    timestamp TIMESTAMPTZ,
    product_links TEXT[] DEFAULT '{}',
    engagement JSONB DEFAULT '{}', -- likes, comments, shares, views
    raw_data JSONB DEFAULT '{}',   -- original API response
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(account_id, source, source_post_id)
);

-- Products (extracted/resolved product data)
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    creator_id UUID REFERENCES creators(id) ON DELETE SET NULL,
    post_id UUID REFERENCES posts(id) ON DELETE SET NULL,

    -- Source information
    source_link TEXT NOT NULL,
    resolved_url TEXT,
    source_platform TEXT CHECK (source_platform IN (
        'amazon', 'ltk', 'shopmy', 'target', 'walmart', 'other'
    )),

    -- Product details
    brand TEXT,
    title TEXT,
    description TEXT,
    category TEXT,

    -- Identifiers (critical for cross-platform matching)
    gtin TEXT,           -- Global Trade Item Number
    upc TEXT,            -- Universal Product Code
    ean TEXT,            -- European Article Number
    asin TEXT,           -- Amazon Standard Identification Number
    sku TEXT,            -- Stock Keeping Unit
    isbn TEXT,           -- For books
    mpn TEXT,            -- Manufacturer Part Number

    -- Pricing & media
    price NUMERIC(10, 2),
    currency TEXT DEFAULT 'USD',
    image_url TEXT,
    additional_images TEXT[] DEFAULT '{}',

    -- Metadata
    raw_data JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for product identifier lookups
CREATE INDEX idx_products_gtin ON products(gtin) WHERE gtin IS NOT NULL;
CREATE INDEX idx_products_upc ON products(upc) WHERE upc IS NOT NULL;
CREATE INDEX idx_products_asin ON products(asin) WHERE asin IS NOT NULL;
CREATE INDEX idx_products_brand_title ON products(account_id, brand, title);

-- Matches (cross-platform product matches)
CREATE TABLE matches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    creator_id UUID REFERENCES creators(id) ON DELETE SET NULL,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,

    -- Target marketplace
    marketplace TEXT NOT NULL CHECK (marketplace IN (
        'amazon',
        'target',
        'walmart',
        'tiktok_shop',
        'shopify'
    )),

    -- External product reference
    external_id TEXT NOT NULL,  -- ASIN, TCIN, product_id, etc.
    external_url TEXT,

    -- Match details
    matched_title TEXT,
    matched_brand TEXT,
    price NUMERIC(10, 2),
    currency TEXT DEFAULT 'USD',
    commission_rate NUMERIC(5, 4),  -- e.g., 0.0450 = 4.5%

    -- Match quality
    confidence_score INTEGER NOT NULL CHECK (confidence_score BETWEEN 0 AND 100),
    match_method TEXT CHECK (match_method IN (
        'exact_gtin',
        'exact_upc',
        'exact_asin',
        'brand_title',
        'fuzzy_title',
        'category_price',
        'manual'
    )),
    match_status TEXT NOT NULL DEFAULT 'pending' CHECK (match_status IN (
        'pending',
        'confirmed',
        'rejected',
        'expired',
        'unavailable'
    )),
    reason TEXT,  -- Explanation for match/rejection

    -- Timestamps
    matched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    confirmed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(product_id, marketplace, external_id)
);

-- Content Packs (repurposed content bundles)
CREATE TABLE content_packs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    creator_id UUID REFERENCES creators(id) ON DELETE SET NULL,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    post_id UUID REFERENCES posts(id) ON DELETE SET NULL,

    -- Generated content
    caption TEXT,
    hashtags TEXT[] DEFAULT '{}',
    suggested_hooks TEXT[] DEFAULT '{}',

    -- Affiliate/shop links per platform
    ltk_url TEXT,
    amazon_url TEXT,
    target_url TEXT,
    walmart_url TEXT,
    tiktok_shop_url TEXT,
    shopmy_url TEXT,

    -- Media assets
    media_urls TEXT[] DEFAULT '{}',
    thumbnail_url TEXT,

    -- Status
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
        'draft',
        'ready',
        'published',
        'archived'
    )),

    -- Timestamps
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Audit Logs (activity tracking)
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
    actor TEXT NOT NULL,  -- user_id, 'system', 'api', etc.
    action TEXT NOT NULL, -- 'create', 'update', 'delete', 'match', 'publish'
    target_type TEXT,     -- 'product', 'match', 'content_pack', etc.
    target_id UUID,
    meta JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for audit log queries
CREATE INDEX idx_audit_logs_account_created ON audit_logs(account_id, created_at DESC);
CREATE INDEX idx_audit_logs_target ON audit_logs(target_type, target_id);

-- =============================================================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================================================

-- Enable RLS on all tables
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE creators ENABLE ROW LEVEL SECURITY;
ALTER TABLE connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper function to get current user's account_id from JWT
CREATE OR REPLACE FUNCTION auth.account_id()
RETURNS UUID AS $$
    SELECT COALESCE(
        (current_setting('request.jwt.claims', true)::jsonb ->> 'account_id')::uuid,
        NULL
    );
$$ LANGUAGE SQL STABLE;

-- Accounts: users can only see their own account
CREATE POLICY "Users can view own account"
    ON accounts FOR SELECT
    USING (id = auth.account_id());

CREATE POLICY "Users can update own account"
    ON accounts FOR UPDATE
    USING (id = auth.account_id());

-- Creators: users can only see creators in their account
CREATE POLICY "Users can view account creators"
    ON creators FOR SELECT
    USING (account_id = auth.account_id());

CREATE POLICY "Users can insert account creators"
    ON creators FOR INSERT
    WITH CHECK (account_id = auth.account_id());

CREATE POLICY "Users can update account creators"
    ON creators FOR UPDATE
    USING (account_id = auth.account_id());

CREATE POLICY "Users can delete account creators"
    ON creators FOR DELETE
    USING (account_id = auth.account_id());

-- Connections: users can only see connections in their account
CREATE POLICY "Users can view account connections"
    ON connections FOR SELECT
    USING (account_id = auth.account_id());

CREATE POLICY "Users can insert account connections"
    ON connections FOR INSERT
    WITH CHECK (account_id = auth.account_id());

CREATE POLICY "Users can update account connections"
    ON connections FOR UPDATE
    USING (account_id = auth.account_id());

CREATE POLICY "Users can delete account connections"
    ON connections FOR DELETE
    USING (account_id = auth.account_id());

-- Posts: users can only see posts in their account
CREATE POLICY "Users can view account posts"
    ON posts FOR SELECT
    USING (account_id = auth.account_id());

CREATE POLICY "Users can insert account posts"
    ON posts FOR INSERT
    WITH CHECK (account_id = auth.account_id());

CREATE POLICY "Users can update account posts"
    ON posts FOR UPDATE
    USING (account_id = auth.account_id());

CREATE POLICY "Users can delete account posts"
    ON posts FOR DELETE
    USING (account_id = auth.account_id());

-- Products: users can only see products in their account
CREATE POLICY "Users can view account products"
    ON products FOR SELECT
    USING (account_id = auth.account_id());

CREATE POLICY "Users can insert account products"
    ON products FOR INSERT
    WITH CHECK (account_id = auth.account_id());

CREATE POLICY "Users can update account products"
    ON products FOR UPDATE
    USING (account_id = auth.account_id());

CREATE POLICY "Users can delete account products"
    ON products FOR DELETE
    USING (account_id = auth.account_id());

-- Matches: users can only see matches in their account
CREATE POLICY "Users can view account matches"
    ON matches FOR SELECT
    USING (account_id = auth.account_id());

CREATE POLICY "Users can insert account matches"
    ON matches FOR INSERT
    WITH CHECK (account_id = auth.account_id());

CREATE POLICY "Users can update account matches"
    ON matches FOR UPDATE
    USING (account_id = auth.account_id());

CREATE POLICY "Users can delete account matches"
    ON matches FOR DELETE
    USING (account_id = auth.account_id());

-- Content Packs: users can only see content packs in their account
CREATE POLICY "Users can view account content_packs"
    ON content_packs FOR SELECT
    USING (account_id = auth.account_id());

CREATE POLICY "Users can insert account content_packs"
    ON content_packs FOR INSERT
    WITH CHECK (account_id = auth.account_id());

CREATE POLICY "Users can update account content_packs"
    ON content_packs FOR UPDATE
    USING (account_id = auth.account_id());

CREATE POLICY "Users can delete account content_packs"
    ON content_packs FOR DELETE
    USING (account_id = auth.account_id());

-- Audit Logs: users can only view their account's logs (no insert/update/delete)
CREATE POLICY "Users can view account audit_logs"
    ON audit_logs FOR SELECT
    USING (account_id = auth.account_id());

-- =============================================================================
-- TRIGGERS
-- =============================================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER accounts_updated_at
    BEFORE UPDATE ON accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER creators_updated_at
    BEFORE UPDATE ON creators
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER connections_updated_at
    BEFORE UPDATE ON connections
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER posts_updated_at
    BEFORE UPDATE ON posts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER products_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER matches_updated_at
    BEFORE UPDATE ON matches
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER content_packs_updated_at
    BEFORE UPDATE ON content_packs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================================================
-- INDEXES FOR COMMON QUERIES
-- =============================================================================

-- Foreign key indexes
CREATE INDEX idx_creators_account ON creators(account_id);
CREATE INDEX idx_connections_account ON connections(account_id);
CREATE INDEX idx_connections_creator ON connections(creator_id);
CREATE INDEX idx_posts_account ON posts(account_id);
CREATE INDEX idx_posts_creator ON posts(creator_id);
CREATE INDEX idx_posts_source ON posts(account_id, source, timestamp DESC);
CREATE INDEX idx_products_account ON products(account_id);
CREATE INDEX idx_products_creator ON products(creator_id);
CREATE INDEX idx_products_post ON products(post_id);
CREATE INDEX idx_matches_account ON matches(account_id);
CREATE INDEX idx_matches_product ON matches(product_id);
CREATE INDEX idx_matches_marketplace ON matches(account_id, marketplace);
CREATE INDEX idx_matches_status ON matches(account_id, match_status);
CREATE INDEX idx_content_packs_account ON content_packs(account_id);
CREATE INDEX idx_content_packs_product ON content_packs(product_id);

-- =============================================================================
-- VIEWS
-- =============================================================================

-- View: Products with their best matches
CREATE VIEW products_with_matches AS
SELECT
    p.*,
    m.marketplace,
    m.external_id,
    m.external_url,
    m.confidence_score,
    m.match_status,
    m.commission_rate
FROM products p
LEFT JOIN LATERAL (
    SELECT *
    FROM matches
    WHERE product_id = p.id
      AND match_status = 'confirmed'
    ORDER BY confidence_score DESC
    LIMIT 1
) m ON true;

-- View: Content pack summary with all links
CREATE VIEW content_pack_summary AS
SELECT
    cp.id,
    cp.account_id,
    c.display_name AS creator_name,
    p.title AS product_title,
    p.brand AS product_brand,
    cp.caption,
    cp.hashtags,
    cp.status,
    jsonb_build_object(
        'ltk', cp.ltk_url,
        'amazon', cp.amazon_url,
        'target', cp.target_url,
        'walmart', cp.walmart_url,
        'tiktok_shop', cp.tiktok_shop_url
    ) AS affiliate_links,
    cp.generated_at,
    cp.published_at
FROM content_packs cp
JOIN products p ON cp.product_id = p.id
LEFT JOIN creators c ON cp.creator_id = c.id;
