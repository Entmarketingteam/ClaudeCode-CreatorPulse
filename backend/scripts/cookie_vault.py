"""
Cookie Vault - Secure storage and retrieval of session cookies for affiliate platforms.
Uses AES-256 encryption for at-rest security.
"""

import os
import json
import base64
from typing import Optional, Dict, Any
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from supabase import create_client, Client


class CookieVault:
    """Manages encrypted cookie storage and retrieval."""

    def __init__(self):
        self.supabase: Client = create_client(
            os.environ.get("SUPABASE_URL", ""),
            os.environ.get("SUPABASE_SERVICE_KEY", "")
        )
        self.encryption_key = self._get_encryption_key()
        self.fernet = Fernet(self.encryption_key)

    def _get_encryption_key(self) -> bytes:
        """Derive encryption key from master secret."""
        master_secret = os.environ.get("COOKIE_ENCRYPTION_SECRET", "").encode()
        salt = os.environ.get("COOKIE_ENCRYPTION_SALT", "creator-pulse-salt").encode()

        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=salt,
            iterations=480000,
        )
        key = base64.urlsafe_b64encode(kdf.derive(master_secret))
        return key

    def encrypt_cookies(self, cookies: Dict[str, Any]) -> str:
        """Encrypt cookies for storage."""
        cookies_json = json.dumps(cookies)
        encrypted = self.fernet.encrypt(cookies_json.encode())
        return base64.urlsafe_b64encode(encrypted).decode()

    def decrypt_cookies(self, encrypted_cookies: str) -> Dict[str, Any]:
        """Decrypt cookies from storage."""
        encrypted_bytes = base64.urlsafe_b64decode(encrypted_cookies)
        decrypted = self.fernet.decrypt(encrypted_bytes)
        return json.loads(decrypted.decode())

    async def get_cookies(self, user_id: str, platform: str) -> Optional[Dict[str, Any]]:
        """Retrieve and decrypt cookies for a user's platform."""
        try:
            result = self.supabase.table("platform_credentials").select(
                "encrypted_cookies"
            ).eq("user_id", user_id).eq("platform", platform).single().execute()

            if result.data and result.data.get("encrypted_cookies"):
                return self.decrypt_cookies(result.data["encrypted_cookies"])
            return None
        except Exception as e:
            print(f"Error retrieving cookies: {e}")
            return None

    async def save_cookies(
        self,
        user_id: str,
        platform: str,
        cookies: Dict[str, Any]
    ) -> bool:
        """Encrypt and save cookies for a user's platform."""
        try:
            encrypted = self.encrypt_cookies(cookies)

            self.supabase.table("platform_credentials").upsert({
                "user_id": user_id,
                "platform": platform,
                "encrypted_cookies": encrypted,
                "status": "active",
            }).execute()

            return True
        except Exception as e:
            print(f"Error saving cookies: {e}")
            return False

    async def update_status(
        self,
        user_id: str,
        platform: str,
        status: str,
        error: Optional[str] = None
    ) -> bool:
        """Update credential status (active, expired, needs_2fa, invalid)."""
        try:
            update_data = {"status": status}
            if error:
                update_data["last_error"] = error

            self.supabase.table("platform_credentials").update(
                update_data
            ).eq("user_id", user_id).eq("platform", platform).execute()

            return True
        except Exception as e:
            print(f"Error updating status: {e}")
            return False

    async def record_sync(self, user_id: str, platform: str) -> bool:
        """Record successful sync timestamp."""
        try:
            self.supabase.table("platform_credentials").update({
                "last_sync_at": "now()",
                "last_error": None,
            }).eq("user_id", user_id).eq("platform", platform).execute()

            return True
        except Exception as e:
            print(f"Error recording sync: {e}")
            return False


def format_cookies_for_playwright(cookies: Dict[str, Any]) -> list:
    """Convert cookie dict to Playwright's expected format."""
    playwright_cookies = []

    for name, value in cookies.items():
        if isinstance(value, dict):
            # Already in proper format
            playwright_cookies.append(value)
        else:
            # Simple key-value format
            playwright_cookies.append({
                "name": name,
                "value": str(value),
                "domain": "",  # Will be set by caller
                "path": "/",
            })

    return playwright_cookies
