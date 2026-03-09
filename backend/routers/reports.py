"""
Reports router: generate traffic and device summary reports.
"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone, timedelta
from core.db import get_db
from core.auth import get_current_user

router = APIRouter(prefix="/reports", tags=["reports"])


class ReportRequest(BaseModel):
    period: str
    device_id: Optional[str] = None


@router.post("/generate")
async def generate_report(data: ReportRequest, user=Depends(get_current_user)):
    db = get_db()
    now = datetime.now(timezone.utc)
    hours = {"daily": 24, "weekly": 168, "monthly": 720}
    h = hours.get(data.period, 24)
    start = now - timedelta(hours=h)
    label = {"daily": "Daily Report", "weekly": "Weekly Report", "monthly": "Monthly Report"}.get(data.period, "Report")

    all_devs = await db.devices.find(
        {}, {"_id": 0, "snmp_community": 0, "api_password": 0, "last_poll_data": 0}
    ).to_list(100)

    query = {"timestamp": {"$gte": start.isoformat()}}
    if data.device_id:
        query["device_id"] = data.device_id
    history = await db.traffic_history.find(query, {"_id": 0}).sort("timestamp", 1).to_list(5000)

    trend = []
    for h_item in history:
        try:
            dt = datetime.fromisoformat(h_item["timestamp"])
            tl = dt.strftime("%H:%M") if data.period == "daily" else dt.strftime("%d/%m %H:%M")
        except Exception:
            tl = ""
        bw = h_item.get("bandwidth", {})
        dl = sum(v.get("download_bps", 0) for v in bw.values())
        ul = sum(v.get("upload_bps", 0) for v in bw.values())
        trend.append({
            "time": tl, "download": round(dl / 1e6, 2), "upload": round(ul / 1e6, 2),
            "ping": h_item.get("ping_ms", 0), "jitter": h_item.get("jitter_ms", 0)
        })

    if trend:
        avg_dl = round(sum(t["download"] for t in trend) / len(trend), 2)
        avg_ul = round(sum(t["upload"] for t in trend) / len(trend), 2)
        peak_dl = round(max(t["download"] for t in trend), 2)
        peak_ul = round(max(t["upload"] for t in trend), 2)
        avg_ping = round(sum(t["ping"] for t in trend) / len(trend), 1)
        avg_jitter = round(sum(t["jitter"] for t in trend) / len(trend), 1)
    else:
        avg_dl = avg_ul = peak_dl = peak_ul = avg_ping = avg_jitter = 0

    dev_summary = [{
        "name": d["name"], "ip_address": d.get("ip_address", ""), "model": d.get("model", ""),
        "status": d.get("status", "unknown"), "cpu": d.get("cpu_load", 0),
        "memory": d.get("memory_usage", 0), "uptime": d.get("uptime", "")
    } for d in all_devs]

    return {
        "label": label, "period": data.period, "generated_at": now.isoformat(),
        "start_date": start.isoformat(), "end_date": now.isoformat(),
        "summary": {
            "devices": {"total": len(all_devs), "online": sum(1 for d in all_devs if d.get("status") == "online")},
            "avg_bandwidth": {"download": avg_dl, "upload": avg_ul},
            "peak_bandwidth": {"download": peak_dl, "upload": peak_ul},
            "avg_ping": avg_ping, "avg_jitter": avg_jitter
        },
        "traffic_trend": trend[-300:], "device_summary": dev_summary,
    }
