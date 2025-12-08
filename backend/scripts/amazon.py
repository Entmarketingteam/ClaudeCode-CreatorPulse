"""
Amazon Associates Revenue Scraper
Uses the "Golden Selector" approach with Playwright for report downloads.
"""

import os
import asyncio
import csv
import io
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from playwright.async_api import async_playwright, Browser, Page, TimeoutError
from supabase import create_client, Client

from cookie_vault import CookieVault, format_cookies_for_playwright


class AmazonScraper:
    """Scrapes revenue data from Amazon Associates."""

    ASSOCIATES_URL = "https://affiliate-program.amazon.com"
    REPORTS_URL = f"{ASSOCIATES_URL}/home/reports/table"

    # The "Golden Selector" - reliable element for triggering report download
    DOWNLOAD_SELECTOR = "#ac-report-download-launcher-osp"

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
        cookies = await self.cookie_vault.get_cookies(user_id, "amazon")
        if not cookies:
            result["error"] = "No credentials found"
            return result

        if not self.browser:
            await self.init_browser()

        context = await self.browser.new_context(
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
        )

        try:
            # Set cookies
            playwright_cookies = format_cookies_for_playwright(cookies)
            for cookie in playwright_cookies:
                cookie["domain"] = ".amazon.com"
            await context.add_cookies(playwright_cookies)

            page = await context.new_page()

            # Navigate to reports
            await page.goto(self.REPORTS_URL, wait_until="networkidle", timeout=30000)

            # Check if logged in
            if "signin" in page.url.lower():
                await self.cookie_vault.update_status(
                    user_id, "amazon", "expired", "Session expired - please re-authenticate"
                )
                result["error"] = "Session expired"
                return result

            # Wait for report table to load
            await page.wait_for_selector(".ac-report-table", timeout=15000)

            # Get date range (last 30 days)
            end_date = datetime.now()
            start_date = end_date - timedelta(days=30)

            # Set date range if date picker exists
            date_picker = await page.query_selector("#ac-daterange-picker")
            if date_picker:
                await self._set_date_range(page, start_date, end_date)

            # Download report using Golden Selector
            csv_content = await self._download_report(page)

            if csv_content:
                # Parse and store revenue events
                records = await self._parse_csv(csv_content, user_id)
                result["records_processed"] = len(records)
                result["success"] = True

                await self.cookie_vault.record_sync(user_id, "amazon")
            else:
                result["error"] = "Failed to download report"

        except TimeoutError:
            result["error"] = "Page load timeout - Amazon may be slow"
            await self.cookie_vault.update_status(
                user_id, "amazon", "active", result["error"]
            )
        except Exception as e:
            result["error"] = str(e)
            # Check if it's an auth error
            if "signin" in str(e).lower() or "login" in str(e).lower():
                await self.cookie_vault.update_status(
                    user_id, "amazon", "expired", "Session expired"
                )
        finally:
            await context.close()

        return result

    async def _set_date_range(self, page: Page, start: datetime, end: datetime):
        """Set the date range for the report."""
        try:
            await page.click("#ac-daterange-picker")
            await page.wait_for_selector(".ac-daterange-calendar", timeout=5000)

            # Click custom range option
            await page.click("text=Custom")

            # Set start date
            start_input = await page.query_selector("input[name='startDate']")
            if start_input:
                await start_input.fill(start.strftime("%m/%d/%Y"))

            # Set end date
            end_input = await page.query_selector("input[name='endDate']")
            if end_input:
                await end_input.fill(end.strftime("%m/%d/%Y"))

            # Apply
            await page.click("button:has-text('Apply')")
            await page.wait_for_load_state("networkidle")

        except Exception as e:
            print(f"Date range setting failed (using default): {e}")

    async def _download_report(self, page: Page) -> Optional[str]:
        """Download the CSV report using the Golden Selector."""
        try:
            # Wait for download button
            await page.wait_for_selector(self.DOWNLOAD_SELECTOR, timeout=10000)

            # Set up download handler
            async with page.expect_download() as download_info:
                await page.click(self.DOWNLOAD_SELECTOR)

            download = await download_info.value

            # Read CSV content
            path = await download.path()
            with open(path, "r", encoding="utf-8") as f:
                content = f.read()

            return content

        except Exception as e:
            print(f"Download failed: {e}")
            return None

    async def _parse_csv(self, csv_content: str, user_id: str) -> List[Dict[str, Any]]:
        """Parse CSV content and store revenue events."""
        records = []

        reader = csv.DictReader(io.StringIO(csv_content))

        for row in reader:
            try:
                # Map Amazon CSV columns to our schema
                record = {
                    "user_id": user_id,
                    "platform": "amazon",
                    "order_id": row.get("Order ID", row.get("Tracking ID")),
                    "product_name": row.get("Product Name", row.get("Item Name")),
                    "product_asin": row.get("ASIN"),
                    "product_category": row.get("Category"),
                    "quantity": int(row.get("Quantity", row.get("Items Shipped", 1)) or 1),
                    "order_amount": self._parse_currency(
                        row.get("Revenue", row.get("Product Price", "0"))
                    ),
                    "commission_amount": self._parse_currency(
                        row.get("Earnings", row.get("Ad Fees", "0"))
                    ),
                    "commission_rate": self._parse_percentage(
                        row.get("Rate", row.get("Commission Rate", "0%"))
                    ),
                    "order_date": self._parse_date(
                        row.get("Date", row.get("Date Shipped"))
                    ),
                    "tracking_id": row.get("Tracking ID"),
                    "raw_data": row,
                }

                # Insert into database (upsert to handle duplicates)
                self.supabase.table("revenue_events").upsert(
                    record,
                    on_conflict="platform,order_id"
                ).execute()

                records.append(record)

            except Exception as e:
                print(f"Error parsing row: {e}")
                continue

        return records

    def _parse_currency(self, value: str) -> float:
        """Parse currency string to float."""
        if not value:
            return 0.0
        # Remove currency symbols and commas
        cleaned = value.replace("$", "").replace(",", "").strip()
        try:
            return float(cleaned)
        except ValueError:
            return 0.0

    def _parse_percentage(self, value: str) -> float:
        """Parse percentage string to decimal."""
        if not value:
            return 0.0
        cleaned = value.replace("%", "").strip()
        try:
            return float(cleaned) / 100
        except ValueError:
            return 0.0

    def _parse_date(self, value: str) -> Optional[str]:
        """Parse date string to ISO format."""
        if not value:
            return None

        formats = [
            "%m/%d/%Y",
            "%Y-%m-%d",
            "%d/%m/%Y",
            "%B %d, %Y",
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
        print("Usage: python amazon.py <user_id>")
        return

    user_id = sys.argv[1]

    scraper = AmazonScraper()
    await scraper.init_browser()

    try:
        result = await scraper.scrape_user(user_id)
        print(f"Result: {result}")
    finally:
        await scraper.close_browser()


if __name__ == "__main__":
    asyncio.run(main())
