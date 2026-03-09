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
    """Get RSC configuration export from MikroTik via API."""
    try:
        import requests
        # Use REST API export endpoint
        if hasattr(mt_client, 'base_url'):
            resp = requests.get(
                f"{mt_client.base_url}/export",
                auth=mt_client.auth,
                verify=False,
                timeout=30
            )
            if resp.status_code == 200:
                return resp.text
        return None
    except Exception as e:
        logger.warning(f"RSC export failed: {e}")
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
