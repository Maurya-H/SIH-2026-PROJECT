from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional
from app.db import get_connection
from app.services.h3_filter import get_h3_index

router = APIRouter()

VALID_STATUSES = {"pending", "in_progress", "resolved"}


class IncidentCreate(BaseModel):
    category: str          # waterlogging / pothole / fallen_tree / other
    description: str = ""
    photo_url: str = ""
    latitude: float
    longitude: float
    reported_by: str = "anonymous"


class IncidentStatusUpdate(BaseModel):
    status: str


@router.post("/")
def create_incident(incident: IncidentCreate):
    """Citizen submits a new incident report."""
    h3_index = get_h3_index(incident.latitude, incident.longitude)

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO incidents (category, description, photo_url, location, h3_index, status, reported_by)
                VALUES (%s, %s, %s, ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography, %s, 'pending', %s)
                RETURNING id
                """,
                (incident.category, incident.description, incident.photo_url,
                 incident.longitude, incident.latitude, h3_index, incident.reported_by),
            )
            new_id = cur.fetchone()["id"]

    return {"id": new_id, "h3_index": h3_index, "message": "Incident reported successfully"}


@router.get("/")
def list_incidents(
    near_lat: Optional[float] = Query(None, description="Latitude to filter around (district/nagar palika center)"),
    near_lng: Optional[float] = Query(None, description="Longitude to filter around"),
    radius_km: Optional[float] = Query(None, description="Radius in km around near_lat/near_lng"),
):
    """
    Officer dashboard: get incidents with lat/lng.

    Without params, returns everything (unchanged behaviour).
    With near_lat/near_lng/radius_km, returns only incidents within that
    radius — used for the district / nagar palika filter on the map, since
    incidents are stored as geography points rather than admin-boundary names.
    """
    use_radius = near_lat is not None and near_lng is not None and radius_km is not None

    with get_connection() as conn:
        with conn.cursor() as cur:
            if use_radius:
                cur.execute(
                    """
                    SELECT id, category, description, photo_url, status, reported_by, created_at, h3_index,
                           citizen_confirmed,
                           ST_Y(location::geometry) AS latitude,
                           ST_X(location::geometry) AS longitude
                    FROM incidents
                    WHERE ST_DWithin(
                        location,
                        ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography,
                        %s
                    )
                    ORDER BY created_at DESC
                    """,
                    (near_lng, near_lat, radius_km * 1000),  # ST_DWithin wants meters
                )
            else:
                cur.execute(
                    """
                    SELECT id, category, description, photo_url, status, reported_by, created_at, h3_index,
                           citizen_confirmed,
                           ST_Y(location::geometry) AS latitude,
                           ST_X(location::geometry) AS longitude
                    FROM incidents
                    ORDER BY created_at DESC
                    """
                )
            rows = cur.fetchall()

    return rows


@router.get("/{incident_id}")
def get_incident(incident_id: int):
    """Get a single incident by ID."""
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, category, description, photo_url, status, reported_by, created_at, h3_index,
                       citizen_confirmed,
                       ST_Y(location::geometry) AS latitude,
                       ST_X(location::geometry) AS longitude
                FROM incidents WHERE id = %s
                """,
                (incident_id,),
            )
            row = cur.fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Incident not found")
    return row


@router.patch("/{incident_id}")
def update_incident_status(incident_id: int, update: IncidentStatusUpdate):
    """
    Officer dashboard: advance an incident's status
    (pending -> in_progress -> resolved).
    """
    if update.status not in VALID_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status '{update.status}'. Must be one of {sorted(VALID_STATUSES)}",
        )

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE incidents
                SET status = %s
                WHERE id = %s
                RETURNING id, category, description, photo_url, status, reported_by, created_at, h3_index,
                          citizen_confirmed,
                          ST_Y(location::geometry) AS latitude,
                          ST_X(location::geometry) AS longitude
                """,
                (update.status, incident_id),
            )
            updated_row = cur.fetchone()

    if not updated_row:
        raise HTTPException(status_code=404, detail="Incident not found")

    return updated_row


@router.patch("/{incident_id}/confirm")
def confirm_incident_resolution(incident_id: int):
    """
    Citizen confirms that a resolved issue was actually fixed. Only
    allowed once the officer has marked it 'resolved' — closes the loop
    between officer action and citizen-verified outcome.
    """
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT status FROM incidents WHERE id = %s", (incident_id,))
            existing = cur.fetchone()

            if not existing:
                raise HTTPException(status_code=404, detail="Incident not found")
            if existing["status"] != "resolved":
                raise HTTPException(
                    status_code=400,
                    detail="Only resolved incidents can be confirmed by the citizen",
                )

            cur.execute(
                """
                UPDATE incidents
                SET citizen_confirmed = TRUE
                WHERE id = %s
                RETURNING id, category, description, photo_url, status, reported_by, created_at, h3_index,
                          citizen_confirmed,
                          ST_Y(location::geometry) AS latitude,
                          ST_X(location::geometry) AS longitude
                """,
                (incident_id,),
            )
            updated_row = cur.fetchone()

    return updated_row