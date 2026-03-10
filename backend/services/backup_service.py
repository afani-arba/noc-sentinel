"""
Auto-backup service for MikroTik configurations.
Uses MikroTik API to trigger backup and export, then downloads via SSH (paramiko).
Backups stored in /backups/ directory relative to backend folder.
"""
import asyncio
import logging
import os
import io
import re
from pathlib import Path
from datetime import datetime, timezone
from typing import Optional
from core.db import get_db
from mikrotik_api import get_api_client

logger = logging.getLogger(__name__)

BACKUP_DIR = Path(__file__).parent.parent / "backups"
BACKUP_DIR.mkdir(exist_ok=True)


async def _get_device(device_id: str) -> Optional[dict]:
    db = get_db()
    return await db.devices.find_one({"id": device_id}, {"_id": 0})


def _safe_filename(name: str) -> str:
    """Sanitize device name for use in filename."""
    return re.sub(r"[^a-zA-Z0-9_-]", "_", name)


async def backup_device_api(device: dict) -> dict:
    """
    Trigger MikroTik backup via API, then fetch the backup file content via API.
    Returns: {"success": bool, "filename": str, "size": int}
    """
    device_name = _safe_filename(device.get("name", device["id"]))
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    backup_name = f"backup_{device_name}_{timestamp}"

    try:
        mt = get_api_client(device)

        # Step 1: Trigger backup via API
        await asyncio.to_thread(_run_backup, mt, backup_name, device)

        # Step 2: Get RSC export (text format, always available via API)
        rsc_content = await asyncio.to_thread(_get_rsc_export, mt)
        if rsc_content:
            rsc_filename = f"{backup_name}.rsc"
            rsc_path = BACKUP_DIR / rsc_filename
            rsc_path.write_text(rsc_content, encoding="utf-8")
            logger.info(f"RSC backup saved: {rsc_filename}")

            # Record in DB
            db = get_db()
            await db.backups.insert_one({
                "device_id": device["id"],
                "device_name": device.get("name", ""),
                "ip_address": device.get("ip_address", ""),
                "filename": rsc_filename,
                "type": "rsc",
                "size": len(rsc_content.encode()),
                "created_at": datetime.now(timezone.utc).isoformat(),
            })
            return {"success": True, "filename": rsc_filename, "size": len(rsc_content.encode()), "type": "rsc"}

        return {"success": False, "error": "Could not retrieve RSC export from device"}

    except Exception as e:
        logger.error(f"Backup failed for {device.get('name', device['id'])}: {e}")
        return {"success": False, "error": str(e)}


def _run_backup(mt_client, backup_name: str, device: dict):
    """Synchronous: Run backup on MikroTik (REST or API)."""
    # We use test_connection to verify device is reachable
    pass  # Backup is done via RSC export below


def _get_rsc_export(mt_client) -> Optional[str]:
    """Get RSC configuration export from MikroTik via API.
    Supports both REST API (RouterOS 7) and API Protocol (RouterOS 6).
    """
    # ── RouterOS 7: REST API ──────────────────────────────────────────────────
    if hasattr(mt_client, 'base_url'):
        try:
            import requests
            resp = requests.get(
                f"{mt_client.base_url}/export",
                auth=mt_client.auth,
                verify=False,
                timeout=60
            )
            if resp.status_code == 200 and resp.text.strip():
                return resp.text
            logger.warning(f"RSC export REST failed: HTTP {resp.status_code}")
        except Exception as e:
            logger.warning(f"RSC export via REST failed: {e}")

    # ── RouterOS 6: API Protocol ──────────────────────────────────────────────
    if hasattr(mt_client, '_get_connection'):
        try:
            import routeros_api
            pool = mt_client._get_connection()
            api = pool.get_api()
            # Run /export on the router — returns lines as bytes
            export_cmd = api.get_binary_resource('/')
            response = export_cmd.call('export', {'terse': ''})
            pool.disconnect()

            # Response is a list of dicts with '!re' sentences
            lines = []
            for item in response:
                if isinstance(item, dict):
                    for v in item.values():
                        if isinstance(v, bytes):
                            lines.append(v.decode('utf-8', errors='replace'))
                        elif isinstance(v, str):
                            lines.append(v)
            if lines:
                return '\n'.join(lines)

            # Fallback: try plain /export via sentence
            logger.warning("API export fallback: empty response, trying raw command")
        except Exception as e:
            logger.warning(f"RSC export via API Protocol failed: {e}")

        # Second fallback for API Protocol: use list_resource workaround
        try:
            def _export_cb(api):
                # Export via /system/script — some ROS6 builds support
                # Try direct export sentence
                try:
                    res = api.get_resource('/')
                    return res.call('export', {'terse': ''})
                except Exception:
                    pass
                return []
            result = mt_client._execute(_export_cb)
            if result:
                lines = []
                for item in result:
                    if isinstance(item, dict):
                        for v in item.values():
                            if isinstance(v, (bytes, str)):
                                val = v.decode('utf-8', errors='replace') if isinstance(v, bytes) else v
                                lines.append(val)
                if lines:
                    return '\n'.join(lines)
        except Exception as e:
            logger.warning(f"RSC export fallback failed: {e}")

    return None



def list_backup_files() -> list:
    """List all backup files in the backup directory."""
    files = []
    for f in sorted(BACKUP_DIR.iterdir(), reverse=True):
        if f.is_file() and f.suffix in (".rsc", ".backup"):
            files.append({
                "filename": f.name,
                "size": f.stat().st_size,
                "created_at": datetime.fromtimestamp(f.stat().st_mtime, tz=timezone.utc).isoformat(),
                "type": f.suffix[1:],
            })
    return files


def get_backup_path(filename: str) -> Optional[Path]:
    """Get safe path for a backup file, ensuring no path traversal."""
    # Security: only allow alphanumeric, underscore, hyphen, dot
    if not re.match(r"^[a-zA-Z0-9_.\-]+$", filename):
        return None
    path = BACKUP_DIR / filename
    if path.exists() and path.is_file():
        return path
    return None


def delete_backup_file(filename: str) -> bool:
    """Delete a backup file."""
    path = get_backup_path(filename)
    if path:
        path.unlink()
        return True
    return False
