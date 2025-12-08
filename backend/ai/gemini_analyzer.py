"""
Gemini AI Video Analyzer
Analyzes creator content videos using Google's Gemini 1.5 Pro for creative attribute extraction.
"""

import os
import json
import asyncio
from typing import Optional, Dict, Any, List
import httpx
import google.generativeai as genai
from supabase import create_client, Client


# Configure Gemini
genai.configure(api_key=os.environ.get("GOOGLE_AI_API_KEY", ""))


class GeminiAnalyzer:
    """Analyzes video content using Gemini 1.5 Pro."""

    ANALYSIS_PROMPT = """
    Analyze this creator content video and extract the following attributes in JSON format:

    1. visual_format: One of [talking_head, voiceover, product_only, lifestyle, tutorial, unboxing, haul, grwm, review]
    2. hook_strategy: One of [question, statement, controversy, teaser, direct, story, transformation]
    3. hook_text: The first 10-15 words spoken in the video (the hook)
    4. production_style: One of [polished, raw, mixed]
    5. has_text_overlay: boolean - Does the video have text overlays?
    6. has_music: boolean - Does the video have background music?
    7. has_voiceover: boolean - Is there voiceover narration?
    8. has_face_visible: boolean - Is a person's face visible in the video?
    9. lighting_quality: 1-5 scale (1=poor, 5=professional)
    10. audio_quality: 1-5 scale (1=poor, 5=professional)
    11. pacing_score: 1-5 scale (1=slow/boring, 5=fast/engaging)
    12. product_visibility_score: 1-5 scale (1=not visible, 5=prominently featured)
    13. cta_present: boolean - Is there a call-to-action?
    14. cta_type: If CTA present, one of [link_in_bio, swipe_up, comment, shop_now, other]
    15. primary_colors: Array of 3-5 dominant colors in the video (hex codes)
    16. scene_count: Estimated number of distinct scenes/cuts

    Also provide:
    17. content_summary: A brief 1-2 sentence summary of what the video is about
    18. product_mentioned: Name of any products featured (if identifiable)
    19. estimated_duration_seconds: Estimated video length in seconds

    Respond ONLY with valid JSON, no additional text.
    """

    def __init__(self):
        self.supabase: Client = create_client(
            os.environ.get("SUPABASE_URL", ""),
            os.environ.get("SUPABASE_SERVICE_KEY", "")
        )
        self.model = genai.GenerativeModel("gemini-1.5-pro")

    async def analyze_content(self, content_id: str) -> Dict[str, Any]:
        """Analyze a content item and store results."""
        result = {
            "success": False,
            "content_id": content_id,
            "error": None
        }

        try:
            # Get content details from database
            content_response = self.supabase.table("content_master").select(
                "*"
            ).eq("id", content_id).single().execute()

            if not content_response.data:
                result["error"] = "Content not found"
                return result

            content = content_response.data
            video_url = content.get("url")

            if not video_url:
                result["error"] = "No video URL found"
                return result

            # Download video or get video URL for analysis
            video_data = await self._get_video_content(video_url)

            if not video_data:
                result["error"] = "Failed to retrieve video"
                return result

            # Analyze with Gemini
            analysis = await self._analyze_video(video_data, video_url)

            if analysis:
                # Store analysis results
                await self._store_analysis(content_id, analysis)

                # Update content as analyzed
                self.supabase.table("content_master").update({
                    "is_analyzed": True
                }).eq("id", content_id).execute()

                result["success"] = True
                result["analysis"] = analysis
            else:
                result["error"] = "Analysis failed"

        except Exception as e:
            result["error"] = str(e)

        return result

    async def _get_video_content(self, url: str) -> Optional[Dict[str, Any]]:
        """Get video content for analysis."""
        try:
            # For Instagram/TikTok, we might need to extract the actual video URL
            if "instagram.com" in url:
                return await self._extract_instagram_video(url)
            elif "tiktok.com" in url:
                return await self._extract_tiktok_video(url)
            else:
                # Direct video URL
                return {"url": url, "type": "url"}

        except Exception as e:
            print(f"Error getting video content: {e}")
            return None

    async def _extract_instagram_video(self, url: str) -> Optional[Dict[str, Any]]:
        """Extract video URL from Instagram."""
        try:
            # Use oEmbed API for metadata
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"https://api.instagram.com/oembed/?url={url}",
                    timeout=10.0
                )
                if response.status_code == 200:
                    data = response.json()
                    return {
                        "url": url,
                        "thumbnail": data.get("thumbnail_url"),
                        "title": data.get("title"),
                        "type": "instagram",
                    }
        except Exception as e:
            print(f"Instagram extraction error: {e}")

        return {"url": url, "type": "instagram"}

    async def _extract_tiktok_video(self, url: str) -> Optional[Dict[str, Any]]:
        """Extract video URL from TikTok."""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"https://www.tiktok.com/oembed?url={url}",
                    timeout=10.0
                )
                if response.status_code == 200:
                    data = response.json()
                    return {
                        "url": url,
                        "thumbnail": data.get("thumbnail_url"),
                        "title": data.get("title"),
                        "type": "tiktok",
                    }
        except Exception as e:
            print(f"TikTok extraction error: {e}")

        return {"url": url, "type": "tiktok"}

    async def _analyze_video(
        self,
        video_data: Dict[str, Any],
        original_url: str
    ) -> Optional[Dict[str, Any]]:
        """Send video to Gemini for analysis."""
        try:
            # Prepare the prompt with video context
            context = f"""
            Video URL: {original_url}
            Platform: {video_data.get('type', 'unknown')}
            Title: {video_data.get('title', 'N/A')}
            """

            # For now, use thumbnail analysis if available
            # In production, you'd download and upload the actual video
            thumbnail_url = video_data.get("thumbnail")

            if thumbnail_url:
                # Analyze thumbnail (as proxy for video content)
                response = self.model.generate_content([
                    f"{self.ANALYSIS_PROMPT}\n\nVideo Context:\n{context}",
                    {"mime_type": "image/jpeg", "uri": thumbnail_url}
                ])
            else:
                # Text-only analysis based on URL context
                response = self.model.generate_content(
                    f"{self.ANALYSIS_PROMPT}\n\nVideo Context:\n{context}\n\n"
                    "Note: Analyze based on the video URL and platform patterns. "
                    "Provide your best estimates for the attributes."
                )

            # Parse JSON response
            response_text = response.text

            # Clean up response if needed
            if "```json" in response_text:
                response_text = response_text.split("```json")[1].split("```")[0]
            elif "```" in response_text:
                response_text = response_text.split("```")[1].split("```")[0]

            analysis = json.loads(response_text.strip())

            # Add confidence score
            analysis["ai_confidence_score"] = 0.85 if thumbnail_url else 0.60

            return analysis

        except json.JSONDecodeError as e:
            print(f"JSON parsing error: {e}")
            return None
        except Exception as e:
            print(f"Analysis error: {e}")
            return None

    async def _store_analysis(self, content_id: str, analysis: Dict[str, Any]):
        """Store analysis results in the database."""
        try:
            # Map analysis to database schema
            record = {
                "content_id": content_id,
                "visual_format": analysis.get("visual_format"),
                "hook_strategy": analysis.get("hook_strategy"),
                "hook_text": analysis.get("hook_text"),
                "production_style": analysis.get("production_style"),
                "has_text_overlay": analysis.get("has_text_overlay", False),
                "has_music": analysis.get("has_music", False),
                "has_voiceover": analysis.get("has_voiceover", False),
                "has_face_visible": analysis.get("has_face_visible", False),
                "lighting_quality": analysis.get("lighting_quality"),
                "audio_quality": analysis.get("audio_quality"),
                "pacing_score": analysis.get("pacing_score"),
                "product_visibility_score": analysis.get("product_visibility_score"),
                "cta_present": analysis.get("cta_present", False),
                "cta_type": analysis.get("cta_type"),
                "primary_colors": analysis.get("primary_colors", []),
                "scene_count": analysis.get("scene_count"),
                "ai_confidence_score": analysis.get("ai_confidence_score", 0.5),
                "raw_analysis": analysis,
            }

            # Upsert to handle re-analysis
            self.supabase.table("creative_attributes").upsert(
                record,
                on_conflict="content_id"
            ).execute()

        except Exception as e:
            print(f"Error storing analysis: {e}")
            raise

    async def batch_analyze(self, content_ids: List[str]) -> Dict[str, Any]:
        """Analyze multiple content items."""
        results = {
            "total": len(content_ids),
            "successful": 0,
            "failed": 0,
            "errors": []
        }

        for content_id in content_ids:
            result = await self.analyze_content(content_id)

            if result["success"]:
                results["successful"] += 1
            else:
                results["failed"] += 1
                results["errors"].append({
                    "content_id": content_id,
                    "error": result["error"]
                })

            # Rate limiting - be nice to Gemini API
            await asyncio.sleep(1)

        return results

    async def analyze_pending(self, user_id: str, limit: int = 10) -> Dict[str, Any]:
        """Analyze pending content for a user."""
        # Get unanalyzed content
        response = self.supabase.table("content_master").select(
            "id"
        ).eq("user_id", user_id).eq("is_analyzed", False).limit(limit).execute()

        if not response.data:
            return {"total": 0, "successful": 0, "failed": 0, "errors": []}

        content_ids = [item["id"] for item in response.data]
        return await self.batch_analyze(content_ids)


async def main():
    """Main entry point for testing."""
    import sys

    if len(sys.argv) < 2:
        print("Usage: python gemini_analyzer.py <content_id>")
        return

    content_id = sys.argv[1]

    analyzer = GeminiAnalyzer()
    result = await analyzer.analyze_content(content_id)
    print(f"Result: {json.dumps(result, indent=2)}")


if __name__ == "__main__":
    asyncio.run(main())
