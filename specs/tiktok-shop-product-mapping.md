# TikTok Shop Product Mapping System Specification

## Overview

A system to enable creators to repurpose content from Instagram/Amazon by matching products via Amazon Product Advertising API to TikTok Shop products, enabling cross-platform sales.

---

## Architecture

```
┌─────────────────────┐     ┌─────────────────────┐     ┌─────────────────────┐
│   Content Sources   │     │   Matching Engine   │     │   TikTok Shop       │
│                     │     │                     │     │                     │
│  - Instagram Posts  │────▶│  - Product Extract  │────▶│  - Product Search   │
│  - Amazon Storefont │     │  - Fuzzy Matching   │     │  - Listing Creation │
│  - Creator Content  │     │  - Confidence Score │     │  - Affiliate Links  │
└─────────────────────┘     └─────────────────────┘     └─────────────────────┘
         │                           │                           │
         ▼                           ▼                           ▼
┌─────────────────────┐     ┌─────────────────────┐     ┌─────────────────────┐
│  Instagram Graph    │     │  Amazon PA-API 5.0  │     │  TikTok Shop        │
│  API                │     │                     │     │  Partner API        │
└─────────────────────┘     └─────────────────────┘     └─────────────────────┘
```

---

## API Documentation & Requirements

### 1. Amazon Product Advertising API 5.0

**Documentation**: https://webservices.amazon.com/paapi5/documentation/

#### Prerequisites
- Amazon Associates account (approved)
- **3 qualifying sales in first 180 days** to unlock API access
- Marketplace-specific credentials (US, UK, etc.)

#### Key Operations

| Operation | Purpose | Use Case |
|-----------|---------|----------|
| `SearchItems` | Search products by keywords/title | Find products from content |
| `GetItems` | Lookup by ASIN | Get full product details |

#### SearchItems Parameters
```json
{
  "PartnerTag": "your-associate-tag",
  "PartnerType": "Associates",
  "Keywords": "product search terms",
  "SearchIndex": "All",  // or specific category
  "ItemCount": 10,
  "Resources": [
    "ItemInfo.Title",
    "ItemInfo.ByLineInfo",
    "ItemInfo.Classifications",
    "ItemInfo.ExternalIds",
    "Images.Primary.Large",
    "Offers.Listings.Price"
  ]
}
```

#### Response Fields for Matching
```json
{
  "ASIN": "B08N5WRWNW",
  "ItemInfo": {
    "Title": { "DisplayValue": "Product Title" },
    "ByLineInfo": {
      "Brand": { "DisplayValue": "Brand Name" },
      "Manufacturer": { "DisplayValue": "Manufacturer" }
    },
    "ExternalIds": {
      "UPCs": { "DisplayValues": ["012345678901"] },
      "EANs": { "DisplayValues": ["0012345678901"] }
    },
    "Classifications": {
      "ProductGroup": { "DisplayValue": "Electronics" }
    }
  },
  "Offers": {
    "Listings": [{
      "Price": { "Amount": 29.99, "Currency": "USD" }
    }]
  }
}
```

#### Rate Limits
- **Base**: 1 request/second
- **Scaling**: +1 request/sec per $4,600 revenue in trailing 30 days

---

### 2. TikTok Shop Partner API

**Documentation**: https://partner.tiktokshop.com/docv2/page/seller-api-overview

#### Prerequisites
- TikTok Shop Seller account
- App registration in Partner Center
- OAuth 2.0 authentication (App Key, App Secret, Service ID)

#### Key Endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET /products/search` | Search products by keyword/title |
| `GET /products/{product_id}` | Get product details |
| `POST /products` | Create new listing |

#### Product Search API
**Endpoint**: `https://partner.tiktokshop.com/docv2/page/search-products-202502`

```json
// Request
{
  "keyword": "product search term",
  "category_id": "optional",
  "page_size": 20,
  "page_number": 1
}

// Response includes
{
  "products": [{
    "product_id": "1234567890",
    "title": "Product Title",
    "brand": "Brand Name",
    "category": { "id": "123", "name": "Category" },
    "price": { "amount": "29.99", "currency": "USD" },
    "images": ["url1", "url2"],
    "identifiers": {
      "gtin": "012345678901",
      "upc": "012345678901",
      "ean": "0012345678901",
      "sku": "VENDOR-SKU-123"
    }
  }]
}
```

#### Product Identifier Requirements
TikTok Shop requires **GTIN/UPC/EAN** for most categories:
- Must be registered with GS1 database
- Validated against GTIN.cloud and GEPIR
- Brand owner verification required

---

### 3. Instagram Graph API

**Documentation**: https://developers.facebook.com/docs/instagram-api

#### Prerequisites
- Instagram Business or Creator account
- Connected Facebook Page
- Facebook Developer App with Instagram Graph API enabled

#### Key Endpoints for Content Extraction

| Endpoint | Purpose |
|----------|---------|
| `GET /{ig-user-id}/media` | List user's media |
| `GET /{ig-media-id}` | Get media details |
| `GET /{ig-media-id}/media_product_tags` | Get product tags (Business only) |

#### Media Response Fields
```json
{
  "id": "media_id",
  "caption": "Post caption with #hashtags @mentions",
  "media_type": "IMAGE|VIDEO|CAROUSEL_ALBUM",
  "media_url": "https://...",
  "permalink": "https://instagram.com/p/...",
  "timestamp": "2025-01-09T12:00:00+0000"
}
```

#### Rate Limits
- 200 calls per user per hour
- Token expiration: 60 days (refresh every 50-55 days)

---

## Fuzzy Matching Strategy

### Matching Fields Priority

| Priority | Field | Match Type | Weight |
|----------|-------|------------|--------|
| 1 | UPC/EAN/GTIN | Exact | 100% |
| 2 | Brand + Model | Exact | 95% |
| 3 | Title | Fuzzy | 70-90% |
| 4 | Category + Price Range | Fuzzy | 50-70% |

### Fuzzy Matching Algorithms

```python
# Recommended libraries
from fuzzywuzzy import fuzz
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

def calculate_match_score(amazon_product, tiktok_product):
    score = 0

    # 1. Exact identifier match (highest confidence)
    if match_identifiers(amazon_product, tiktok_product):
        return 1.0

    # 2. Brand matching
    brand_score = fuzz.ratio(
        normalize(amazon_product['brand']),
        normalize(tiktok_product['brand'])
    ) / 100

    # 3. Title similarity (TF-IDF + cosine)
    title_score = cosine_similarity(
        tfidf.transform([amazon_product['title']]),
        tfidf.transform([tiktok_product['title']])
    )[0][0]

    # 4. Price proximity (within 20% range)
    price_score = 1.0 if price_in_range(
        amazon_product['price'],
        tiktok_product['price'],
        tolerance=0.2
    ) else 0.5

    # Weighted combination
    score = (
        brand_score * 0.3 +
        title_score * 0.5 +
        price_score * 0.2
    )

    return score

def match_identifiers(amazon, tiktok):
    """Check for exact UPC/EAN/GTIN match"""
    amazon_ids = set(amazon.get('upcs', []) + amazon.get('eans', []))
    tiktok_ids = set([tiktok.get('gtin'), tiktok.get('upc'), tiktok.get('ean')])
    return bool(amazon_ids & tiktok_ids)
```

### Text Normalization

```python
import re

def normalize(text):
    """Normalize product titles for comparison"""
    if not text:
        return ""

    text = text.lower()

    # Remove special characters
    text = re.sub(r'[^\w\s]', ' ', text)

    # Remove common noise words
    noise_words = ['the', 'a', 'an', 'and', 'or', 'for', 'with', 'new']
    words = text.split()
    words = [w for w in words if w not in noise_words]

    # Remove size/color variants for initial matching
    size_patterns = r'\b(small|medium|large|xl|xxl|s|m|l|\d+oz|\d+ml)\b'
    text = re.sub(size_patterns, '', ' '.join(words))

    return ' '.join(text.split())
```

---

## System Components

### 1. Content Ingestion Service

```
┌─────────────────────────────────────────────────────────┐
│                Content Ingestion Service                 │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Sources:                                                │
│  ├── Instagram Graph API (posts with product tags)      │
│  ├── Amazon Storefront URL scraping                     │
│  └── Manual product URL input                           │
│                                                          │
│  Output:                                                 │
│  └── Normalized product data (title, brand, identifiers)│
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### 2. Product Resolution Service

```
┌─────────────────────────────────────────────────────────┐
│               Product Resolution Service                 │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Input: Product URL or embedded product data            │
│                                                          │
│  Process:                                                │
│  ├── Extract ASIN from Amazon URLs                      │
│  ├── Call Amazon PA-API GetItems for full details       │
│  └── Return enriched product object                     │
│                                                          │
│  Output:                                                 │
│  {                                                       │
│    asin, title, brand, category,                        │
│    price, images, upc, ean                              │
│  }                                                       │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### 3. TikTok Matching Service

```
┌─────────────────────────────────────────────────────────┐
│               TikTok Matching Service                    │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Input: Enriched Amazon product data                    │
│                                                          │
│  Strategy:                                               │
│  1. Search by UPC/EAN (if available) → exact match      │
│  2. Search by "Brand + Product Name" → high confidence  │
│  3. Search by keywords from title → fuzzy match         │
│  4. Category-filtered search → broader match            │
│                                                          │
│  Output:                                                 │
│  [{                                                      │
│    tiktok_product_id, title, match_score,               │
│    match_method, confidence_level                       │
│  }]                                                      │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### 4. Content Repurposing Service

```
┌─────────────────────────────────────────────────────────┐
│              Content Repurposing Service                 │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Input:                                                  │
│  ├── Original content (image/video URL, caption)        │
│  └── Matched TikTok Shop product                        │
│                                                          │
│  Output:                                                 │
│  ├── TikTok-optimized content package                   │
│  ├── Product affiliate link                             │
│  └── Suggested hashtags/copy                            │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

## Data Models

### Product (Unified)

```typescript
interface Product {
  // Source identification
  source: 'amazon' | 'instagram' | 'tiktok';
  source_id: string;  // ASIN, media_id, product_id
  source_url?: string;

  // Core product data
  title: string;
  brand?: string;
  manufacturer?: string;
  category: string;

  // Identifiers for matching
  identifiers: {
    asin?: string;
    upc?: string[];
    ean?: string[];
    gtin?: string;
    sku?: string;
    isbn?: string;
  };

  // Pricing
  price: {
    amount: number;
    currency: string;
    original_amount?: number;  // Before discount
  };

  // Media
  images: string[];
  videos?: string[];

  // Metadata
  created_at: Date;
  updated_at: Date;
}
```

### ProductMatch

```typescript
interface ProductMatch {
  id: string;

  // Source product (from Amazon/Instagram)
  source_product: Product;

  // Matched TikTok product(s)
  matches: {
    tiktok_product: Product;
    match_score: number;      // 0.0 - 1.0
    match_method: 'exact_identifier' | 'brand_title' | 'fuzzy_title' | 'category';
    confidence: 'high' | 'medium' | 'low';
    matched_fields: string[];
  }[];

  // User action
  selected_match?: string;  // product_id of user-confirmed match
  status: 'pending' | 'confirmed' | 'rejected' | 'no_match';

  created_at: Date;
  updated_at: Date;
}
```

### ContentMapping

```typescript
interface ContentMapping {
  id: string;
  creator_id: string;

  // Original content
  original_content: {
    platform: 'instagram' | 'amazon_storefront';
    content_id: string;
    content_url: string;
    content_type: 'image' | 'video' | 'carousel';
    caption?: string;
    media_urls: string[];
  };

  // Product associations
  product_matches: ProductMatch[];

  // TikTok output
  tiktok_content?: {
    status: 'draft' | 'ready' | 'published';
    product_links: string[];
    suggested_caption?: string;
    suggested_hashtags?: string[];
  };

  created_at: Date;
  published_at?: Date;
}
```

---

## Required Tools & Technologies

### Core Stack

| Component | Recommended Tech | Purpose |
|-----------|-----------------|---------|
| Backend | Node.js / Python | API orchestration |
| Database | PostgreSQL | Product data, matches |
| Cache | Redis | API response caching |
| Queue | Bull / Celery | Async processing |
| Search | Elasticsearch | Fuzzy text matching |

### External Services

| Service | Purpose | Cost Model |
|---------|---------|------------|
| Amazon PA-API 5.0 | Product data | Free (with Associates sales) |
| TikTok Shop Partner API | Product search/listing | Free (seller account) |
| Instagram Graph API | Content extraction | Free (with FB app) |

### Libraries

```json
{
  "dependencies": {
    // API clients
    "amazon-paapi": "^1.0.0",
    "axios": "^1.6.0",

    // Text matching
    "fuzzball": "^2.1.0",
    "natural": "^6.10.0",

    // Data processing
    "cheerio": "^1.0.0",
    "lodash": "^4.17.0",

    // Database
    "prisma": "^5.0.0",
    "ioredis": "^5.3.0"
  }
}
```

---

## Implementation Phases

### Phase 1: Foundation
- [ ] Set up API credentials (Amazon Associates, TikTok Shop Partner, Instagram Graph)
- [ ] Implement Amazon PA-API client with caching
- [ ] Implement TikTok Shop API client
- [ ] Build product data normalization layer

### Phase 2: Matching Engine
- [ ] Implement exact identifier matching (UPC/EAN/GTIN)
- [ ] Build fuzzy title matching with scoring
- [ ] Create brand + category matching fallback
- [ ] Develop match confidence scoring system

### Phase 3: Content Integration
- [ ] Instagram Graph API integration for content extraction
- [ ] Amazon storefront URL parser
- [ ] Content-to-product association pipeline

### Phase 4: Creator Interface
- [ ] Match review/confirmation UI
- [ ] Bulk content processing
- [ ] TikTok Shop listing creation workflow
- [ ] Analytics dashboard

---

## API Rate Limit Handling

```typescript
class RateLimiter {
  private limits = {
    amazon: { requests: 1, per: 1000 },      // 1/sec
    tiktok: { requests: 100, per: 60000 },   // 100/min (estimated)
    instagram: { requests: 200, per: 3600000 } // 200/hour
  };

  async throttle(api: string, fn: () => Promise<any>) {
    // Token bucket implementation
    await this.waitForToken(api);
    return fn();
  }
}
```

---

## Security Considerations

1. **API Credentials**: Store in environment variables / secrets manager
2. **OAuth Tokens**: Implement automatic refresh before expiration
3. **Data Privacy**: Don't store customer PII, only product data
4. **Rate Limits**: Implement exponential backoff on 429 errors

---

## Sources

- [Amazon Product Advertising API 5.0 Documentation](https://webservices.amazon.com/paapi5/documentation/)
- [Amazon PA-API SearchItems](https://webservices.amazon.com/paapi5/documentation/search-items.html)
- [Amazon PA-API GetItems](https://webservices.amazon.com/paapi5/documentation/get-items.html)
- [TikTok Shop Partner Center - Seller API Overview](https://partner.tiktokshop.com/docv2/page/seller-api-overview)
- [TikTok Shop Partner Center - Products API](https://partner.tiktokshop.com/docv2/page/650b23eef1fd3102b93d2326)
- [TikTok Shop Partner Center - Search Products](https://partner.tiktokshop.com/docv2/page/search-products-202502)
- [TikTok Product Query API](https://developers.tiktok.com/doc/research-api-specs-query-tiktok-shop-products)
- [Instagram Graph API Guide 2025](https://elfsight.com/blog/instagram-graph-api-complete-developer-guide-for-2025/)
- [GTINs for TikTok Shop](https://www.barcode-us.info/gtins-for-tiktok-shop/)
