# Creator Pulse

A comprehensive revenue tracking and content analytics platform for creators. Track affiliate earnings across Amazon Associates, LTK, ShopMy, and Mavely in one unified dashboard with AI-powered content analysis.

## Features

- **Unified Revenue Dashboard**: Track earnings from all major affiliate platforms
- **AI Content Analysis**: Gemini-powered video analysis for creative insights
- **Attribution Matching**: Link revenue to specific posts automatically
- **Real-time Sync**: Automated nightly revenue synchronization
- **Mobile-First**: Beautiful React Native app with smooth animations

## Project Structure

```
creator-pulse/
├── mobile/                 # Expo React Native app
│   ├── app/               # Expo Router screens
│   ├── components/        # Reusable UI components
│   ├── lib/               # Utilities, Supabase client, stores
│   └── types/             # TypeScript definitions
├── backend/
│   ├── scripts/           # Playwright scraping scripts
│   │   ├── amazon.py
│   │   ├── ltk.py
│   │   ├── shopmy.py
│   │   └── mavely.py
│   ├── ai/                # AI analysis pipeline
│   │   └── gemini_analyzer.py
│   └── api/               # FastAPI server
│       └── main.py
├── n8n-workflows/         # n8n workflow definitions
├── supabase/
│   └── migrations/        # Database migrations
└── infrastructure/        # Deployment configs
    ├── railway/
    └── render/
```

## Quick Start

### Prerequisites

- Node.js 18+
- Python 3.11+
- Supabase account
- Google AI (Gemini) API key

### Mobile App Setup

```bash
cd mobile
npm install
npx expo start
```

### Backend Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
playwright install chromium

# Set environment variables
cp .env.example .env
# Edit .env with your credentials

# Run API server
uvicorn api.main:app --reload
```

### Database Setup

1. Create a Supabase project
2. Run the migration:
   ```bash
   supabase db push
   ```
   Or manually execute `supabase/migrations/001_initial_schema.sql`

## Environment Variables

### Mobile App (.env)
```
EXPO_PUBLIC_SUPABASE_URL=your-supabase-url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EXPO_PUBLIC_API_URL=your-backend-url
```

### Backend (.env)
```
SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_KEY=your-service-role-key
GOOGLE_AI_API_KEY=your-gemini-api-key
COOKIE_ENCRYPTION_SECRET=32-char-secret
API_KEY=your-api-key
```

## Architecture

### Mobile App
- **Expo Router**: File-based navigation
- **NativeWind**: Tailwind CSS for React Native
- **Zustand**: State management
- **React Native Reanimated 3**: Smooth animations
- **Moti**: Declarative animations

### Backend
- **FastAPI**: High-performance API
- **Playwright**: Browser automation for scraping
- **Gemini 1.5 Pro**: Video/content analysis
- **Supabase**: PostgreSQL database + Auth

### Automation
- **n8n**: Workflow orchestration
  - Nightly revenue sync
  - Content analysis pipeline
  - Attribution matching

## Platform Support

| Platform | Scraping Method | Status |
|----------|----------------|--------|
| Amazon Associates | Playwright + Golden Selector | Supported |
| LTK | API + Browser fallback | Supported |
| ShopMy | Direct API | Supported |
| Mavely | Playwright | Supported |

## Deployment

### Railway
```bash
railway up
```

### Render
Deploy using `infrastructure/render/render.yaml`

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/sync/revenue` | POST | Trigger revenue sync |
| `/analyze/content` | POST | Trigger AI analysis |
| `/attribution/run` | POST | Run attribution matching |
| `/jobs/{id}` | GET | Get job status |

## Security

- AES-256 encrypted cookie storage
- Row Level Security (RLS) on all tables
- API key authentication for webhooks
- Service role keys never exposed to clients

## License

MIT

## Contributing

1. Fork the repository
2. Create a feature branch
3. Submit a pull request
