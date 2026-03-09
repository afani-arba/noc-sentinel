"""
BGP & OSPF Routing router: monitor BGP peers, OSPF neighbors, IP routes.
"""
import asyncio
from fastapi import APIRouter, HTTPException, Depends
from core.db import get_db
from core.auth import get_current_user
from mikrotik_api import get_api_client

router = APIRouter(tags=["routing"])


async def _get_mt(device_id: str):
    db = get_db()
    device = await db.devices.find_one({"id": device_id}, {"_id": 0})
    if not device:
        raise HTTPException(404, "Device not found")
    return get_api_client(device), device


# ── BGP ──────────────────────────────────────────────────────

@router.get("/routing/bgp")
async def get_bgp(device_id: str, user=Depends(get_current_user)):
    """Get BGP peers + sessions status from MikroTik."""
    if not device_id:
        return {"peers": [], "sessions": []}
    try:
        mt, _ = await _get_mt(device_id)
        peers, sessions = await asyncio.gather(
            mt.list_bgp_peers(),
            mt.list_bgp_sessions(),
            return_exceptions=True,
        )
        peers = peers if isinstance(peers, list) else []
        sessions = sessions if isinstance(sessions, list) else []

        # Normalize status field
        normalized_peers = []
        for p in peers:
            state = (
                p.get("state", "") or
                p.get("established", "") or
                p.get("status", "unknown")
            ).lower()

            # Map raw state to clean label
            if "established" in state:
                status = "established"
            elif "active" in state:
                status = "active"
            elif "idle" in state:
                status = "idle"
            elif "connect" in state:
                status = "connect"
            elif "opensent" in state or "openconfirm" in state:
                status = "opening"
            else:
                status = state or "unknown"

            normalized_peers.append({
                **p,
                "_status": status,
                "_is_up": status == "established",
            })

        return {"peers": normalized_peers, "sessions": sessions}
    except Exception as e:
        raise HTTPException(502, f"MikroTik API error: {e}")


# ── OSPF ─────────────────────────────────────────────────────

@router.get("/routing/ospf")
async def get_ospf(device_id: str, user=Depends(get_current_user)):
    """Get OSPF neighbors and instances from MikroTik."""
    if not device_id:
        return {"neighbors": [], "instances": []}
    try:
        mt, _ = await _get_mt(device_id)
        neighbors, instances = await asyncio.gather(
            mt.list_ospf_neighbors(),
            mt.list_ospf_instances(),
            return_exceptions=True,
        )
        neighbors = neighbors if isinstance(neighbors, list) else []
        instances = instances if isinstance(instances, list) else []

        # Normalize neighbor state
        normalized = []
        for n in neighbors:
            state = (n.get("state", "") or n.get("status", "")).lower()
            is_full = "full" in state
            normalized.append({**n, "_state": state, "_is_full": is_full})

        return {"neighbors": normalized, "instances": instances}
    except Exception as e:
        raise HTTPException(502, f"MikroTik API error: {e}")


# ── IP Routes ────────────────────────────────────────────────

@router.get("/routing/routes")
async def get_routes(device_id: str, search: str = "", limit: int = 100, user=Depends(get_current_user)):
    """Get IP routing table from MikroTik."""
    if not device_id:
        return []
    try:
        mt, _ = await _get_mt(device_id)
        routes = await mt.list_ip_routes(limit=limit)

        # Normalize and filter
        result = []
        for r in routes:
            # Determine route type (protocol)
            proto = (
                r.get("routing-mark", "") or
                r.get("protocol", "") or
                ("bgp" if r.get("bgp") == "true" else "") or
                ("ospf" if r.get("ospf") == "true" else "") or
                ("connected" if r.get("type") == "C" else "") or
                ("static" if r.get("type") == "S" else "") or
                "unknown"
            )

            active = r.get("active", "true") == "true"
            dst = r.get("dst-address", r.get("dst_address", ""))

            entry = {
                **r,
                "_dst": dst,
                "_gateway": r.get("gateway", ""),
                "_protocol": proto,
                "_active": active,
                "_distance": r.get("distance", ""),
            }

            if search and search.lower() not in str(entry).lower():
                continue
            result.append(entry)

        return result
    except Exception as e:
        raise HTTPException(502, f"MikroTik API error: {e}")
