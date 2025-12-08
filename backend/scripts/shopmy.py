"""
ShopMy Revenue Scraper
Uses API approach with session cookies for efficient data retrieval.
"""

import os
import asyncio
import json
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
import httpx
from supabase import create_client, Client

from cookie_vault import CookieVault


class ShopMyScraper:
    """Scrapes revenue data from ShopMy using their API."""

    BASE_URL = "https://shopmy.us"
    API_URL = "https://api.shopmy.us"

    def __init__(self):
        self.supabase: Client = create_client(
            os.environ.get("SUPABASE_URL", ""),
            os.environ.get("SUPABASE_SERVICE_KEY", "")
        )
        self.cookie_vault = CookieVault()

    async def scrape_user(self, user_id: str) -> Dict[str, Any]:
        """Scrape revenue data for a specific user."""
        result = {
            "success": False,
            "records_processed": 0,
            "error": None
        }

        # Get user's cookies/credentials
        cookies = await self.cookie_vault.get_cookies(user_id, "shopmy")
        if not cookies:
            result["error"] = "No credentials found"
            return result

        try:
            # Build authentication headers
            headers = self._build_headers(cookies)

            end_date = datetime.now()
            start_date = end_date - timedelta(days=30)

            async with httpx.AsyncClient() as client:
                # Fetch earnings data
                earnings_response = await client.get(
                    f"{self.API_URL}/v1/creator/earnings",
                    params={
                        "start_date": start_date.strftime("%Y-%m-%d"),
                        "end_date": end_date.strftime("%Y-%m-%d"),
                        "page": 1,
                        "per_page": 100,
                    },
                    headers=headers,
                    timeout=30.0
                )

                if earnings_response.status_code == 401:
                    await self.cookie_vault.update_status(
                        user_id, "shopmy", "expired", "Session expired"
                    )
                    result["error"] = "Session expired"
                    return result

                if earnings_response.status_code != 200:
                    result["error"] = f"API error: {earnings_response.status_code}"
                    return result

                earnings_data = earnings_response.json()

                # Process and store earnings
                records = await self._store_earnings(
                    earnings_data.get("data", earnings_data.get("earnings", [])),
                    user_id
                )

                # Handle pagination
                total_pages = earnings_data.get("meta", {}).get("total_pages", 1)
                current_page = 2

                while current_page <= total_pages and current_page <= 10:  # Max 10 pages
                    page_response = await client.get(
                        f"{self.API_URL}/v1/creator/earnings",
                        params={
                            "start_date": start_date.strftime("%Y-%m-%d"),
                            "end_date": end_date.strftime("%Y-%m-%d"),
                            "page": current_page,
                            "per_page": 100,
                        },
                        headers=headers,
                        timeout=30.0
                    )

                    if page_response.status_code == 200:
                        page_data = page_response.json()
                        page_records = await self._store_earnings(
                            page_data.get("data", page_data.get("earnings", [])),
                            user_id
                        )
                        records.extend(page_records)

                    current_page += 1

                result["records_processed"] = len(records)
                result["success"] = True
                await self.cookie_vault.record_sync(user_id, "shopmy")

        except httpx.TimeoutException:
            result["error"] = "Request timeout"
        except Exception as e:
            result["error"] = str(e)

        return result

    def _build_headers(self, cookies: Dict[str, Any]) -> Dict[str, str]:
        """Build request headers from cookies/credentials."""
        headers = {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "Origin": self.BASE_URL,
            "Referer": f"{self.BASE_URL}/dashboard",
        }

        # Check for API token
        if "api_token" in cookies:
            headers["Authorization"] = f"Bearer {cookies['api_token']}"
        elif "access_token" in cookies:
            headers["Authorization"] = f"Bearer {cookies['access_token']}"
        else:
            # Build cookie header
            cookie_parts = []
            for k, v in cookies.items():
                if isinstance(v, dict):
                    cookie_parts.append(f"{v['name']}={v['value']}")
                else:
                    cookie_parts.append(f"{k}={v}")
            headers["Cookie"] = "; ".join(cookie_parts)

        return headers

    async def _store_earnings(
        self,
        earnings: List[Dict[str, Any]],
        user_id: str
    ) -> List[Dict[str, Any]]:
        """Store earnings data in the database."""
        records = []

        for item in earnings:
            try:
                record = {
                    "user_id": user_id,
                    "platform": "shopmy",
                    "order_id": item.get("id", item.get("order_id", item.get("transaction_id"))),
                    "product_name": item.get("product_name", item.get("product", {}).get("name")),
                    "product_category": item.get("category", item.get("product", {}).get("category")),
                    "quantity": item.get("quantity", 1),
                    "order_amount": float(item.get("sale_amount", item.get("order_total", 0)) or 0),
                    "commission_amount": float(item.get("commission", item.get("earnings", 0)) or 0),
                    "commission_rate": self._parse_rate(item.get("commission_rate")),
                    "order_date": item.get("created_at", item.get("order_date")),
                    "click_date": item.get("clicked_at"),
                    "tracking_id": item.get("tracking_id", item.get("link_id")),
                    "raw_data": item,
                }

                # Only insert if we have a valid order_id
                if record["order_id"]:
                    self.supabase.table("revenue_events").upsert(
                        record,
                        on_conflict="platform,order_id"
                    ).execute()
                    records.append(record)

            except Exception as e:
                print(f"Error storing ShopMy record: {e}")
                continue

        return records

    def _parse_rate(self, value: Any) -> Optional[float]:
        """Parse commission rate to decimal."""
        if value is None:
            return None

        if isinstance(value, (int, float)):
            # If it's already a number, check if it needs conversion
            if value > 1:
                return value / 100  # Convert percentage to decimal
            return value

        if isinstance(value, str):
            cleaned = value.replace("%", "").strip()
            try:
                rate = float(cleaned)
                if rate > 1:
                    return rate / 100
                return rate
            except ValueError:
                return None

        return None


async def main():
    """Main entry point for testing."""
    import sys

    if len(sys.argv) < 2:
        print("Usage: python shopmy.py <user_id>")
        return

    user_id = sys.argv[1]

    scraper = ShopMyScraper()
    result = await scraper.scrape_user(user_id)
    print(f"Result: {result}")


if __name__ == "__main__":
    asyncio.run(main())
