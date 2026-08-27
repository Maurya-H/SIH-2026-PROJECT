import math
from datetime import datetime, timezone
from typing import List, Tuple

from app.db import get_connection
from app.services.h3_filter import get_polygon_h3_cells
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()


class PolygonRequest(BaseModel):
    coordinates: List[Tuple[float, float]]


def calculate_ipi(rows: list, zone_area_sq_km: float) -> float:
    weights = {
        "fire": 5.0,
        "fallen_tree": 4.0,
        "pipe_burst": 3.5,
        "waterlogging": 3.0,
        "road_blockage": 2.5,
        "pothole": 2.0,
        "other": 1.0,
    }

    status_multiplier = {
        "pending": 1.0,
        "verified": 0.8,
        "resolved": 0.0,
    }

    now = datetime.now(timezone.utc)
    total_score = 0.0

    for row in rows:
        weight = weights.get(row["category"], 1.0)
        status_mult = status_multiplier.get(row["status"], 1.0)

        created_at = row["created_at"]
        if created_at.tzinfo is None:
            created_at = created_at.replace(tzinfo=timezone.utc)
        age_days = (now - created_at).days
        recency_mult = max(0.3, 1.0 - (age_days / 30) * 0.5)

        total_score += weight * status_mult * recency_mult

    density_score = total_score / max(zone_area_sq_km, 0.01)
    return round(density_score, 2)


def get_priority_label(raw_score: float, total_incidents: int = 0) -> dict:
    normalized = min(100.0, round(math.log1p(raw_score) * 12, 1))

    # Optional floor: ensures 1+ valid incident doesn't display as 0.0 due to high zone area
    if total_incidents > 0 and normalized == 0.0:
        normalized = 1.0

    if normalized < 25:
        label = "Low"
        color = "#16A34A"
    elif normalized < 50:
        label = "Medium"
        color = "#EAB308"
    elif normalized < 75:
        label = "High"
        color = "#F97316"
    else:
        label = "Critical"
        color = "#DC2626"

    return {
        "normalized_score": normalized,
        "priority_label": label,
        "priority_color": color,
    }


@router.post("/zone-score")
def zone_score(polygon: PolygonRequest):
    coords = list(polygon.coordinates)
    if coords and coords[0] != coords[-1]:
        coords.append(coords[0])

    coords_str = ", ".join(f"{lng} {lat}" for lng, lat in coords)
    wkt_polygon = f"POLYGON(({coords_str}))"

    h3_cells = get_polygon_h3_cells(polygon.coordinates)

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT ST_Area(ST_GeomFromText(%s, 4326)::geography) / 1000000.0 AS area_sq_km",
                (wkt_polygon,),
            )
            zone_area_sq_km = cur.fetchone()["area_sq_km"]

            # Query relies directly on ST_Within spatial index without H3 cell restrictions
            cur.execute(
                """
                SELECT category, status, created_at
                FROM incidents
                WHERE ST_Within(location::geometry, ST_GeomFromText(%s, 4326))
                """,
                (wkt_polygon,),
            )
            rows = cur.fetchall()

    category_counts = {}
    for row in rows:
        category_counts[row["category"]] = (
            category_counts.get(row["category"], 0) + 1
        )

    total = len(rows)
    raw_ipi = calculate_ipi(rows, zone_area_sq_km)
    priority = get_priority_label(raw_ipi, total_incidents=total)

    return {
        "total_incidents": total,
        "category_breakdown": category_counts,
        "ipi_score": priority["normalized_score"],
        "priority_label": priority["priority_label"],
        "priority_color": priority["priority_color"],
        "raw_density_score": raw_ipi,
        "zone_area_sq_km": round(zone_area_sq_km, 4),
        "h3_cells_checked": len(h3_cells),
    }