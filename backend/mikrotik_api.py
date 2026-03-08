"""
MikroTik REST API client for CRUD operations.
Requires RouterOS v7.1+ with REST API enabled.
Uses /rest endpoint with HTTP Basic Auth.
"""
import requests
import asyncio
import logging
import urllib3

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
logger = logging.getLogger(__name__)


class MikroTikAPI:
    def __init__(self, host, username, password, port=443, use_ssl=True):
        scheme = "https" if use_ssl else "http"
        self.base_url = f"{scheme}://{host}:{port}/rest"
        self.auth = (username, password)
        self.verify = False
        self.timeout = 10

    def _request(self, method, path, data=None):
        url = f"{self.base_url}/{path}"
        try:
            resp = requests.request(
                method, url, auth=self.auth, json=data,
                verify=self.verify, timeout=self.timeout,
            )
            if resp.status_code == 401:
                raise Exception("Authentication failed - check API username/password")
            if resp.status_code == 400:
                detail = resp.json() if resp.content else {}
                msg = detail.get("detail", detail.get("message", str(resp.text)))
                raise Exception(f"Bad request: {msg}")
            resp.raise_for_status()
            return resp.json() if resp.content else {}
        except requests.exceptions.ConnectionError:
            raise Exception(f"Cannot connect to MikroTik REST API at {url}")
        except requests.exceptions.Timeout:
            raise Exception("Connection timed out")
        except Exception as e:
            if "MikroTik" in str(e) or "Authentication" in str(e) or "Bad request" in str(e) or "Cannot connect" in str(e):
                raise
            raise Exception(f"API error: {e}")

    async def get(self, path):
        return await asyncio.to_thread(self._request, "GET", path)

    async def put(self, path, data):
        return await asyncio.to_thread(self._request, "PUT", path, data)

    async def patch(self, path, data):
        return await asyncio.to_thread(self._request, "PATCH", path, data)

    async def delete(self, path):
        return await asyncio.to_thread(self._request, "DELETE", path)

    async def test_connection(self):
        try:
            result = await self.get("system/identity")
            return {"success": True, "identity": result.get("name", "")}
        except Exception as e:
            return {"success": False, "error": str(e)}

    # --- PPPoE Secrets ---
    async def list_pppoe_secrets(self):
        return await self.get("ppp/secret")

    async def get_pppoe_secret(self, mikrotik_id):
        return await self.get(f"ppp/secret/{mikrotik_id}")

    async def create_pppoe_secret(self, data):
        return await self.put("ppp/secret", data)

    async def update_pppoe_secret(self, mikrotik_id, data):
        return await self.patch(f"ppp/secret/{mikrotik_id}", data)

    async def delete_pppoe_secret(self, mikrotik_id):
        return await self.delete(f"ppp/secret/{mikrotik_id}")

    async def list_pppoe_active(self):
        return await self.get("ppp/active")

    # --- Hotspot Users ---
    async def list_hotspot_users(self):
        return await self.get("ip/hotspot/user")

    async def get_hotspot_user(self, mikrotik_id):
        return await self.get(f"ip/hotspot/user/{mikrotik_id}")

    async def create_hotspot_user(self, data):
        return await self.put("ip/hotspot/user", data)

    async def update_hotspot_user(self, mikrotik_id, data):
        return await self.patch(f"ip/hotspot/user/{mikrotik_id}", data)

    async def delete_hotspot_user(self, mikrotik_id):
        return await self.delete(f"ip/hotspot/user/{mikrotik_id}")

    async def list_hotspot_active(self):
        return await self.get("ip/hotspot/active")

    # --- Interfaces ---
    async def list_interfaces(self):
        return await self.get("interface")

    # --- System ---
    async def get_system_resource(self):
        return await self.get("system/resource")

    async def get_system_identity(self):
        return await self.get("system/identity")


def get_api_client(device: dict) -> MikroTikAPI:
    """Create a MikroTikAPI client from a device document."""
    return MikroTikAPI(
        host=device["ip_address"],
        username=device.get("api_username", "admin"),
        password=device.get("api_password", ""),
        port=device.get("api_port", 443),
        use_ssl=device.get("api_ssl", True),
    )
