"""
Mavely Revenue Scraper
Uses browser automation for data extraction from Mavely dashboard.
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


class MavelyScraper:
    """Scrapes revenue data from Mavely."""

    BASE_URL = "https://mavely.com"
    DASHBOARD_URL = f"{BASE_URL}/dashboard"
    EARNINGS_URL = f"{BASE_URL}/dashboard/earnings"

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
        cookies = await self.cookie_vault.get_cookies(user_id, "mavely")
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
                if not cookie.get("domain"):
                    cookie["domain"] = ".mavely.com"
            await context.add_cookies(playwright_cookies)

            page = await context.new_page()

            # Navigate to earnings page
            await page.goto(self.EARNINGS_URL, wait_until="networkidle", timeout=30000)

            # Check if logged in
            if "login" in page.url.lower() or "signin" in page.url.lower():
                await self.cookie_vault.update_status(
                    user_id, "mavely", "expired", "Session expired - please re-authenticate"
                )
                result["error"] = "Session expired"
                return result

            # Wait for earnings content to load
            await page.wait_for_selector(
                "[data-testid='earnings-list'], .earnings-table, .transaction-list",
                timeout=15000
            )

            # Set date range
            end_date = datetime.now()
            start_date = end_date - timedelta(days=30)
            await self._set_date_range(page, start_date, end_date)

            # Try to download CSV first
            csv_content = await self._try_download_csv(page)

            if csv_content:
                records = await self._parse_csv(csv_content, user_id)
            else:
                # Fall back to scraping the page
                records = await self._scrape_earnings_table(page, user_id)

            result["records_processed"] = len(records)
            result["success"] = True
            await self.cookie_vault.record_sync(user_id, "mavely")

        except TimeoutError:
            result["error"] = "Page load timeout"
            await self.cookie_vault.update_status(user_id, "mavely", "active", result["error"])
        except Exception as e:
            result["error"] = str(e)
            if "login" in str(e).lower():
                await self.cookie_vault.update_status(user_id, "mavely", "expired", "Session expired")
        finally:
            await context.close()

        return result

    async def _set_date_range(self, page: Page, start: datetime, end: datetime):
        """Set the date range filter."""
        try:
            # Look for date picker
            date_picker = await page.query_selector(
                "[data-testid='date-picker'], .date-range-picker, #dateRange"
            )

            if date_picker:
                await date_picker.click()
                await page.wait_for_timeout(500)

                # Try to find and fill date inputs
                start_input = await page.query_selector(
                    "input[name='startDate'], input[placeholder*='Start']"
                )
                end_input = await page.query_selector(
                    "input[name='endDate'], input[placeholder*='End']"
                )

                if start_input:
                    await start_input.fill(start.strftime("%m/%d/%Y"))
                if end_input:
                    await end_input.fill(end.strftime("%m/%d/%Y"))

                # Apply button
                apply_btn = await page.query_selector(
                    "button:has-text('Apply'), button:has-text('Update')"
                )
                if apply_btn:
                    await apply_btn.click()
                    await page.wait_for_load_state("networkidle")

        except Exception as e:
            print(f"Date range setting failed: {e}")

    async def _try_download_csv(self, page: Page) -> Optional[str]:
        """Try to download CSV export."""
        try:
            # Look for export/download button
            export_btn = await page.query_selector(
                "button:has-text('Export'), button:has-text('Download'), "
                "[data-testid='export-btn'], .export-button"
            )

            if export_btn:
                async with page.expect_download(timeout=10000) as download_info:
                    await export_btn.click()

                download = await download_info.value
                path = await download.path()

                with open(path, "r", encoding="utf-8") as f:
                    return f.read()

        except Exception as e:
            print(f"CSV download failed: {e}")

        return None

    async def _scrape_earnings_table(self, page: Page, user_id: str) -> List[Dict[str, Any]]:
        """Scrape earnings data directly from the page."""
        records = []

        try:
            # Find all earnings rows
            rows = await page.query_selector_all(
                ".earnings-row, .transaction-row, tr[data-testid='earning-item']"
            )

            for row in rows:
                try:
                    # Extract data from row
                    product_el = await row.query_selector(
                        ".product-name, .item-name, td:nth-child(1)"
                    )
                    amount_el = await row.query_selector(
                        ".commission, .earnings, td:nth-child(2), .amount"
                    )
                    date_el = await row.query_selector(
                        ".date, td:nth-child(3), .transaction-date"
                    )
                    status_el = await row.query_selector(
                        ".status, td:nth-child(4)"
                    )

                    product_name = await product_el.inner_text() if product_el else "Unknown"
                    amount_text = await amount_el.inner_text() if amount_el else "$0"
                    date_text = await date_el.inner_text() if date_el else ""
                    status = await status_el.inner_text() if status_el else ""

                    # Parse amount
                    amount = self._parse_currency(amount_text)

                    record = {
                        "user_id": user_id,
                        "platform": "mavely",
                        "order_id": f"mavely_{datetime.now().timestamp()}_{len(records)}",
                        "product_name": product_name.strip(),
                        "commission_amount": amount,
                        "order_date": self._parse_date(date_text),
                        "raw_data": {
                            "product": product_name,
                            "amount": amount_text,
                            "date": date_text,
                            "status": status,
                        },
                    }

                    self.supabase.table("revenue_events").upsert(
                        record,
                        on_conflict="platform,order_id"
                    ).execute()

                    records.append(record)

                except Exception as e:
                    print(f"Error parsing row: {e}")
                    continue

        except Exception as e:
            print(f"Error scraping table: {e}")

        return records

    async def _parse_csv(self, csv_content: str, user_id: str) -> List[Dict[str, Any]]:
        """Parse CSV content and store records."""
        records = []

        reader = csv.DictReader(io.StringIO(csv_content))

        for row in reader:
            try:
                record = {
                    "user_id": user_id,
                    "platform": "mavely",
                    "order_id": row.get("Order ID", row.get("Transaction ID", row.get("ID"))),
                    "product_name": row.get("Product", row.get("Item", row.get("Product Name"))),
                    "product_category": row.get("Category", row.get("Brand")),
                    "quantity": int(row.get("Quantity", "1") or "1"),
                    "order_amount": self._parse_currency(
                        row.get("Sale Amount", row.get("Order Total", "0"))
                    ),
                    "commission_amount": self._parse_currency(
                        row.get("Commission", row.get("Earnings", "0"))
                    ),
                    "commission_rate": self._parse_percentage(
                        row.get("Rate", row.get("Commission Rate"))
                    ),
                    "order_date": self._parse_date(row.get("Date", row.get("Order Date"))),
                    "tracking_id": row.get("Link ID", row.get("Tracking ID")),
                    "raw_data": row,
                }

                if record["order_id"]:
                    self.supabase.table("revenue_events").upsert(
                        record,
                        on_conflict="platform,order_id"
                    ).execute()
                    records.append(record)

            except Exception as e:
                print(f"Error parsing CSV row: {e}")
                continue

        return records

    def _parse_currency(self, value: str) -> float:
        """Parse currency string to float."""
        if not value:
            return 0.0
        cleaned = str(value).replace("$", "").replace(",", "").strip()
        try:
            return float(cleaned)
        except ValueError:
            return 0.0

    def _parse_percentage(self, value: str) -> Optional[float]:
        """Parse percentage string to decimal."""
        if not value:
            return None
        cleaned = str(value).replace("%", "").strip()
        try:
            return float(cleaned) / 100
        except ValueError:
            return None

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
            "%m-%d-%Y",
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
        print("Usage: python mavely.py <user_id>")
        return

    user_id = sys.argv[1]

    scraper = MavelyScraper()
    await scraper.init_browser()

    try:
        result = await scraper.scrape_user(user_id)
        print(f"Result: {result}")
    finally:
        await scraper.close_browser()


if __name__ == "__main__":
    asyncio.run(main())
