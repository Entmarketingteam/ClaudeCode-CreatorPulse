"""
LTK (LikeToKnowIt) Revenue Scraper
Uses cookie-based authentication and API endpoints for data retrieval.
"""

import os
import asyncio
import json
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from playwright.async_api import async_playwright, Browser, Page, TimeoutError
import httpx
from supabase import create_client, Client

from cookie_vault import CookieVault, format_cookies_for_playwright


class LTKScraper:
    """Scrapes revenue data from LTK."""

    BASE_URL = "https://company.liketoknow.it"
    API_URL = "https://api.liketoknow.it"
    DASHBOARD_URL = f"{BASE_URL}/analytics"

    def __init__(self):
        self.supabase: Client = create_client(
            os.environ.get("SUPABASE_URL", ""),
            os.environ.get("SUPABASE_SERVICE_KEY", "")
        )
        self.cookie_vault = CookieVault()
        self.browser: Optional[Browser] = None

    async def init_browser(self):
        """Initialize Playwright browser."""
        playwright = await async_playwright().start()
        self.browser = await playwright.chromium.launch(
            headless=True,
            args=["--disable-blink-features=AutomationControlled"]
        )

    async def close_browser(self):
        """Close Playwright browser."""
        if self.browser:
            await self.browser.close()

    async def scrape_user(self, user_id: str) -> Dict[str, Any]:
        """Scrape revenue data for a specific user."""
        result = {
            "success": False,
            "records_processed": 0,
            "error": None
        }

        # Get user's cookies
        cookies = await self.cookie_vault.get_cookies(user_id, "ltk")
        if not cookies:
            result["error"] = "No credentials found"
            return result

        # Try API approach first (faster)
        api_result = await self._try_api_approach(user_id, cookies)
        if api_result["success"]:
            return api_result

        # Fall back to browser scraping
        if not self.browser:
            await self.init_browser()

        context = await self.browser.new_context(
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
        )

        try:
            # Set cookies
            playwright_cookies = format_cookies_for_playwright(cookies)
            for cookie in playwright_cookies:
                if not cookie.get("domain"):
                    cookie["domain"] = ".liketoknow.it"
            await context.add_cookies(playwright_cookies)

            page = await context.new_page()

            # Navigate to analytics dashboard
            await page.goto(self.DASHBOARD_URL, wait_until="networkidle", timeout=30000)

            # Check if logged in
            if "login" in page.url.lower() or "signin" in page.url.lower():
                await self.cookie_vault.update_status(
                    user_id, "ltk", "expired", "Session expired - please re-authenticate"
                )
                result["error"] = "Session expired"
                return result

            # Wait for analytics to load
            await page.wait_for_selector("[data-testid='earnings-card']", timeout=15000)

            # Get date range selector
            end_date = datetime.now()
            start_date = end_date - timedelta(days=30)

            # Extract earnings data
            earnings_data = await self._extract_earnings_from_page(page)

            if earnings_data:
                records = await self._store_earnings(earnings_data, user_id)
                result["records_processed"] = len(records)
                result["success"] = True
                await self.cookie_vault.record_sync(user_id, "ltk")
            else:
                result["error"] = "No earnings data found"

        except TimeoutError:
            result["error"] = "Page load timeout"
            await self.cookie_vault.update_status(user_id, "ltk", "active", result["error"])
        except Exception as e:
            result["error"] = str(e)
            if "login" in str(e).lower():
                await self.cookie_vault.update_status(user_id, "ltk", "expired", "Session expired")
        finally:
            await context.close()

        return result

    async def _try_api_approach(self, user_id: str, cookies: Dict[str, Any]) -> Dict[str, Any]:
        """Try to fetch data via API endpoints."""
        result = {
            "success": False,
            "records_processed": 0,
            "error": None
        }

        try:
            # Build cookie header
            cookie_header = "; ".join([
                f"{k}={v}" if not isinstance(v, dict) else f"{v['name']}={v['value']}"
                for k, v in cookies.items()
            ])

            headers = {
                "Cookie": cookie_header,
                "Accept": "application/json",
                "Origin": self.BASE_URL,
                "Referer": f"{self.BASE_URL}/analytics",
            }

            end_date = datetime.now()
            start_date = end_date - timedelta(days=30)

            async with httpx.AsyncClient() as client:
                # Try the analytics API endpoint
                response = await client.get(
                    f"{self.API_URL}/v1/analytics/earnings",
                    params={
                        "startDate": start_date.strftime("%Y-%m-%d"),
                        "endDate": end_date.strftime("%Y-%m-%d"),
                    },
                    headers=headers,
                    timeout=30.0
                )

                if response.status_code == 401:
                    await self.cookie_vault.update_status(
                        user_id, "ltk", "expired", "Session expired"
                    )
                    result["error"] = "Session expired"
                    return result

                if response.status_code == 200:
                    data = response.json()
                    if data.get("earnings"):
                        records = await self._store_api_earnings(data["earnings"], user_id)
                        result["records_processed"] = len(records)
                        result["success"] = True
                        await self.cookie_vault.record_sync(user_id, "ltk")
                        return result

        except Exception as e:
            print(f"API approach failed: {e}")

        return result

    async def _extract_earnings_from_page(self, page: Page) -> List[Dict[str, Any]]:
        """Extract earnings data from the page."""
        earnings = []

        try:
            # Wait for transaction list
            await page.wait_for_selector(".transaction-item, .earnings-row", timeout=10000)

            # Get all transaction elements
            items = await page.query_selector_all(".transaction-item, .earnings-row")

            for item in items:
                try:
                    # Extract data from each item
                    product_el = await item.query_selector(".product-name, .item-name")
                    amount_el = await item.query_selector(".commission, .earnings-amount")
                    date_el = await item.query_selector(".date, .transaction-date")
                    order_el = await item.query_selector(".order-id")

                    product_name = await product_el.inner_text() if product_el else "Unknown"
                    amount_text = await amount_el.inner_text() if amount_el else "$0"
                    date_text = await date_el.inner_text() if date_el else ""
                    order_id = await order_el.inner_text() if order_el else None

                    # Parse amount
                    amount = float(amount_text.replace("$", "").replace(",", "").strip() or "0")

                    earnings.append({
                        "product_name": product_name,
                        "commission_amount": amount,
                        "order_date": date_text,
                        "order_id": order_id,
                    })

                except Exception as e:
                    print(f"Error extracting item: {e}")
                    continue

        except Exception as e:
            print(f"Error extracting earnings: {e}")

        return earnings

    async def _store_earnings(
        self,
        earnings: List[Dict[str, Any]],
        user_id: str
    ) -> List[Dict[str, Any]]:
        """Store extracted earnings in the database."""
        records = []

        for item in earnings:
            try:
                record = {
                    "user_id": user_id,
                    "platform": "ltk",
                    "order_id": item.get("order_id") or f"ltk_{datetime.now().timestamp()}_{len(records)}",
                    "product_name": item.get("product_name"),
                    "commission_amount": item.get("commission_amount", 0),
                    "order_date": self._parse_date(item.get("order_date")),
                    "raw_data": item,
                }

                self.supabase.table("revenue_events").upsert(
                    record,
                    on_conflict="platform,order_id"
                ).execute()

                records.append(record)

            except Exception as e:
                print(f"Error storing record: {e}")
                continue

        return records

    async def _store_api_earnings(
        self,
        earnings: List[Dict[str, Any]],
        user_id: str
    ) -> List[Dict[str, Any]]:
        """Store API earnings data."""
        records = []

        for item in earnings:
            try:
                record = {
                    "user_id": user_id,
                    "platform": "ltk",
                    "order_id": item.get("orderId", item.get("id")),
                    "product_name": item.get("productName", item.get("itemName")),
                    "product_category": item.get("category"),
                    "order_amount": item.get("saleAmount", 0),
                    "commission_amount": item.get("commission", item.get("earnings", 0)),
                    "commission_rate": item.get("commissionRate", 0),
                    "order_date": item.get("orderDate", item.get("date")),
                    "tracking_id": item.get("trackingId"),
                    "raw_data": item,
                }

                self.supabase.table("revenue_events").upsert(
                    record,
                    on_conflict="platform,order_id"
                ).execute()

                records.append(record)

            except Exception as e:
                print(f"Error storing API record: {e}")
                continue

        return records

    def _parse_date(self, value: str) -> Optional[str]:
        """Parse date string to ISO format."""
        if not value:
            return None

        formats = [
            "%m/%d/%Y",
            "%Y-%m-%d",
            "%d/%m/%Y",
            "%B %d, %Y",
            "%b %d, %Y",
        ]

        for fmt in formats:
            try:
                dt = datetime.strptime(value.strip(), fmt)
                return dt.isoformat()
            except ValueError:
                continue

        return None


async def main():
    """Main entry point for testing."""
    import sys

    if len(sys.argv) < 2:
        print("Usage: python ltk.py <user_id>")
        return

    user_id = sys.argv[1]

    scraper = LTKScraper()
    await scraper.init_browser()

    try:
        result = await scraper.scrape_user(user_id)
        print(f"Result: {result}")
    finally:
        await scraper.close_browser()


if __name__ == "__main__":
    asyncio.run(main())
