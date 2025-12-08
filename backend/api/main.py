"""
Creator Pulse API Server
FastAPI backend for scraping triggers, webhooks, and data processing.
"""

import os
from datetime import datetime
from typing import Optional, List
from fastapi import FastAPI, HTTPException, BackgroundTasks, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import asyncio

# Import scrapers and analyzer
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from scripts.amazon import AmazonScraper
from scripts.ltk import LTKScraper
from scripts.shopmy import ShopMyScraper
from scripts.mavely import MavelyScraper
from ai.gemini_analyzer import GeminiAnalyzer
from supabase import create_client, Client


app = FastAPI(
    title="Creator Pulse API",
    description="Backend API for Creator Pulse revenue tracking",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Supabase client
supabase: Client = create_client(
    os.environ.get("SUPABASE_URL", ""),
    os.environ.get("SUPABASE_SERVICE_KEY", "")
)

# API Key verification
API_KEY = os.environ.get("API_KEY", "")


async def verify_api_key(x_api_key: str = Header(...)):
    if x_api_key != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key")
    return x_api_key


# Request/Response models
class SyncRequest(BaseModel):
    user_id: str
    platform: Optional[str] = None  # If None, sync all platforms


class SyncResponse(BaseModel):
    success: bool
    job_id: str
    message: str


class AnalyzeRequest(BaseModel):
    content_id: Optional[str] = None
    user_id: Optional[str] = None


class HealthResponse(BaseModel):
    status: str
    timestamp: str
    version: str


# Initialize scrapers
scrapers = {
    "amazon": AmazonScraper(),
    "ltk": LTKScraper(),
    "shopmy": ShopMyScraper(),
    "mavely": MavelyScraper(),
}
analyzer = GeminiAnalyzer()


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint."""
    return HealthResponse(
        status="healthy",
        timestamp=datetime.now().isoformat(),
        version="1.0.0"
    )


@app.post("/sync/revenue", response_model=SyncResponse, dependencies=[Depends(verify_api_key)])
async def sync_revenue(request: SyncRequest, background_tasks: BackgroundTasks):
    """Trigger revenue sync for a user."""

    # Create sync job record
    job_data = {
        "user_id": request.user_id,
        "platform": request.platform,
        "job_type": "revenue_sync",
        "status": "pending",
    }
    job_response = supabase.table("sync_jobs").insert(job_data).execute()
    job_id = job_response.data[0]["id"]

    # Run sync in background
    background_tasks.add_task(
        run_revenue_sync,
        job_id,
        request.user_id,
        request.platform
    )

    return SyncResponse(
        success=True,
        job_id=job_id,
        message=f"Sync job started for {request.platform or 'all platforms'}"
    )


async def run_revenue_sync(job_id: str, user_id: str, platform: Optional[str]):
    """Execute revenue sync in background."""
    try:
        # Update job status
        supabase.table("sync_jobs").update({
            "status": "running",
            "started_at": datetime.now().isoformat()
        }).eq("id", job_id).execute()

        total_records = 0
        platforms_to_sync = [platform] if platform else ["amazon", "ltk", "shopmy", "mavely"]

        for plat in platforms_to_sync:
            scraper = scrapers.get(plat)
            if scraper:
                # Initialize browser if needed
                if hasattr(scraper, "init_browser"):
                    await scraper.init_browser()

                try:
                    result = await scraper.scrape_user(user_id)
                    if result["success"]:
                        total_records += result.get("records_processed", 0)
                finally:
                    if hasattr(scraper, "close_browser"):
                        await scraper.close_browser()

        # Update job as completed
        supabase.table("sync_jobs").update({
            "status": "completed",
            "completed_at": datetime.now().isoformat(),
            "records_processed": total_records
        }).eq("id", job_id).execute()

    except Exception as e:
        # Update job as failed
        supabase.table("sync_jobs").update({
            "status": "failed",
            "completed_at": datetime.now().isoformat(),
            "error_message": str(e)
        }).eq("id", job_id).execute()


@app.post("/analyze/content", response_model=SyncResponse, dependencies=[Depends(verify_api_key)])
async def analyze_content(request: AnalyzeRequest, background_tasks: BackgroundTasks):
    """Trigger content analysis."""

    if not request.content_id and not request.user_id:
        raise HTTPException(
            status_code=400,
            detail="Either content_id or user_id must be provided"
        )

    # Create sync job record
    job_data = {
        "user_id": request.user_id or "system",
        "job_type": "content_analysis",
        "status": "pending",
        "metadata": {"content_id": request.content_id}
    }
    job_response = supabase.table("sync_jobs").insert(job_data).execute()
    job_id = job_response.data[0]["id"]

    # Run analysis in background
    background_tasks.add_task(
        run_content_analysis,
        job_id,
        request.content_id,
        request.user_id
    )

    return SyncResponse(
        success=True,
        job_id=job_id,
        message="Analysis job started"
    )


async def run_content_analysis(
    job_id: str,
    content_id: Optional[str],
    user_id: Optional[str]
):
    """Execute content analysis in background."""
    try:
        # Update job status
        supabase.table("sync_jobs").update({
            "status": "running",
            "started_at": datetime.now().isoformat()
        }).eq("id", job_id).execute()

        if content_id:
            result = await analyzer.analyze_content(content_id)
            records_processed = 1 if result["success"] else 0
        elif user_id:
            result = await analyzer.analyze_pending(user_id, limit=20)
            records_processed = result.get("successful", 0)
        else:
            records_processed = 0

        # Update job as completed
        supabase.table("sync_jobs").update({
            "status": "completed",
            "completed_at": datetime.now().isoformat(),
            "records_processed": records_processed
        }).eq("id", job_id).execute()

    except Exception as e:
        # Update job as failed
        supabase.table("sync_jobs").update({
            "status": "failed",
            "completed_at": datetime.now().isoformat(),
            "error_message": str(e)
        }).eq("id", job_id).execute()


@app.get("/jobs/{job_id}")
async def get_job_status(job_id: str, _: str = Depends(verify_api_key)):
    """Get status of a sync job."""
    response = supabase.table("sync_jobs").select("*").eq("id", job_id).single().execute()

    if not response.data:
        raise HTTPException(status_code=404, detail="Job not found")

    return response.data


@app.post("/webhook/n8n/sync", dependencies=[Depends(verify_api_key)])
async def n8n_sync_webhook(request: SyncRequest, background_tasks: BackgroundTasks):
    """Webhook endpoint for n8n to trigger syncs."""
    return await sync_revenue(request, background_tasks)


@app.post("/webhook/n8n/analyze", dependencies=[Depends(verify_api_key)])
async def n8n_analyze_webhook(request: AnalyzeRequest, background_tasks: BackgroundTasks):
    """Webhook endpoint for n8n to trigger analysis."""
    return await analyze_content(request, background_tasks)


@app.post("/attribution/run", dependencies=[Depends(verify_api_key)])
async def run_attribution(user_id: str, background_tasks: BackgroundTasks):
    """Run attribution matching for a user."""

    # Create job
    job_data = {
        "user_id": user_id,
        "job_type": "attribution",
        "status": "pending",
    }
    job_response = supabase.table("sync_jobs").insert(job_data).execute()
    job_id = job_response.data[0]["id"]

    background_tasks.add_task(run_attribution_matching, job_id, user_id)

    return SyncResponse(
        success=True,
        job_id=job_id,
        message="Attribution matching started"
    )


async def run_attribution_matching(job_id: str, user_id: str):
    """Run attribution matching algorithm."""
    try:
        supabase.table("sync_jobs").update({
            "status": "running",
            "started_at": datetime.now().isoformat()
        }).eq("id", job_id).execute()

        # Get unattributed revenue events
        revenue_response = supabase.table("revenue_events").select(
            "*"
        ).eq("user_id", user_id).is_("attributed_content_id", "null").execute()

        # Get content for matching
        content_response = supabase.table("content_master").select(
            "*"
        ).eq("user_id", user_id).execute()

        attributed_count = 0
        revenue_events = revenue_response.data or []
        content_items = content_response.data or []

        for event in revenue_events:
            best_match = None
            best_confidence = 0

            for content in content_items:
                confidence = calculate_attribution_confidence(event, content)

                if confidence > best_confidence and confidence >= 0.5:
                    best_match = content
                    best_confidence = confidence

            if best_match:
                # Create attribution record
                supabase.table("content_revenue_attribution").insert({
                    "content_id": best_match["id"],
                    "revenue_event_id": event["id"],
                    "attribution_confidence": best_confidence,
                    "attribution_method": "fuzzy_match"
                }).execute()

                # Update revenue event
                supabase.table("revenue_events").update({
                    "attributed_content_id": best_match["id"]
                }).eq("id", event["id"]).execute()

                attributed_count += 1

        supabase.table("sync_jobs").update({
            "status": "completed",
            "completed_at": datetime.now().isoformat(),
            "records_processed": attributed_count
        }).eq("id", job_id).execute()

    except Exception as e:
        supabase.table("sync_jobs").update({
            "status": "failed",
            "completed_at": datetime.now().isoformat(),
            "error_message": str(e)
        }).eq("id", job_id).execute()


def calculate_attribution_confidence(event: dict, content: dict) -> float:
    """Calculate confidence score for attribution match."""
    confidence = 0.0

    # Time-based matching
    if event.get("order_date") and content.get("posted_at"):
        event_date = datetime.fromisoformat(event["order_date"].replace("Z", "+00:00"))
        post_date = datetime.fromisoformat(content["posted_at"].replace("Z", "+00:00"))

        days_diff = (event_date - post_date).days

        if 0 <= days_diff <= 7:
            confidence += 0.4  # Strong time correlation
        elif 0 <= days_diff <= 14:
            confidence += 0.25
        elif 0 <= days_diff <= 30:
            confidence += 0.15

    # Product name matching in caption
    if event.get("product_name") and content.get("caption"):
        product_words = event["product_name"].lower().split()
        caption_lower = content["caption"].lower()

        matches = sum(1 for word in product_words if word in caption_lower)
        if matches > 0:
            confidence += min(0.3, matches * 0.1)

    # Hashtag matching
    if content.get("hashtags"):
        product_name = (event.get("product_name") or "").lower()
        for hashtag in content["hashtags"]:
            if hashtag.lower() in product_name or product_name in hashtag.lower():
                confidence += 0.15
                break

    # Tracking ID matching
    if event.get("tracking_id"):
        tracking_id = event["tracking_id"].lower()
        if content.get("url") and tracking_id in content["url"].lower():
            confidence += 0.4

    return min(1.0, confidence)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
