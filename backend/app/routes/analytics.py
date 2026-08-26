from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Tuple
from app.db import get_connection

router = APIRouter()


class PolygonRequest(BaseModel):
    # List of [longitude, latitude] pairs forming a closed polygon
    coordinates: List[Tuple[float, float]]


def calculate_ipi(category_counts: dict, total_incidents: int) -> float:
    """
    Simple IPI (Incident Priority Index) formula.
    Weights different categories by severity, scaled by volume.
    Tune these weights based on your team's judgment before the demo.
    """
    weights = {
        "waterlogging": 3.0,
        "pothole": 2.0,
        "fallen_tree": 2.5,
        "other": 1.0,
    }
    score = sum(weights.get(cat, 1.0) * count for cat, count in category_counts.items())
    # Normalize a bit so score doesn't run away with large counts
    ipi = round(score / max(total_incidents, 1) * total_incidents, 2)
    return ipi


@router.post("/zone-score")
def zone_score(polygon: PolygonRequest):
    """
    Officer draws a polygon -> we find all incidents inside it (using PostGIS)
    and compute an IPI score.
    """
    # Build WKT polygon string, e.g. "POLYGON((lng1 lat1, lng2 lat2, ...))"
    coords_str = ", ".join(f"{lng} {lat}" for lng, lat in polygon.coordinates)
    wkt_polygon = f"POLYGON(({coords_str}))"

    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        """
        SELECT category, COUNT(*) as count
        FROM incidents
        WHERE ST_Within(
            location::geometry,
            ST_GeomFromText(%s, 4326)
        )
        GROUP BY category
        """,
        (wkt_polygon,),
    )
    rows = cur.fetchall()
    cur.close()
    conn.close()

    category_counts = {row["category"]: row["count"] for row in rows}
    total = sum(category_counts.values())
    ipi = calculate_ipi(category_counts, total)

    return {
        "total_incidents": total,
        "category_breakdown": category_counts,
        "ipi_score": ipi,
    }