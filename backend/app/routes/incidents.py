from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.db import get_connection

router = APIRouter()


class IncidentCreate(BaseModel):
    category: str          # waterlogging / pothole / fallen_tree / other
    description: str = ""
    photo_url: str = ""
    latitude: float
    longitude: float
    reported_by: str = "anonymous"


@router.post("/")
def create_incident(incident: IncidentCreate):
    """Citizen submits a new incident report."""
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        """
        INSERT INTO incidents (category, description, photo_url, location, status, reported_by)
        VALUES (%s, %s, %s, ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography, 'pending', %s)
        RETURNING id
        """,
        (incident.category, incident.description, incident.photo_url,
         incident.longitude, incident.latitude, incident.reported_by),
    )
    new_id = cur.fetchone()["id"]
    conn.commit()
    cur.close()
    conn.close()
    return {"id": new_id, "message": "Incident reported successfully"}


@router.get("/")
def list_incidents():
    """Officer dashboard: get all incidents with lat/lng."""
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        """
        SELECT id, category, description, photo_url, status, reported_by, created_at,
               ST_Y(location::geometry) AS latitude,
               ST_X(location::geometry) AS longitude
        FROM incidents
        ORDER BY created_at DESC
        """
    )
    rows = cur.fetchall()
    cur.close()
    conn.close()
    return rows


@router.get("/{incident_id}")
def get_incident(incident_id: int):
    """Get a single incident by ID."""
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        """
        SELECT id, category, description, photo_url, status, reported_by, created_at,
               ST_Y(location::geometry) AS latitude,
               ST_X(location::geometry) AS longitude
        FROM incidents WHERE id = %s
        """,
        (incident_id,),
    )
    row = cur.fetchone()
    cur.close()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Incident not found")
    return row