from fastapi import APIRouter, Query
from typing import Optional

router = APIRouter()

# Hardcoded for the prototype — swap this for a real DB table
# (e.g. a `municipalities` table with district/name/lat/lng columns)
# once you're past the demo stage. Keeping the same names/coords as the
# frontend's LUCKNOW_NAGAR_PALIKA_FALLBACK so both stay in sync.
# NOTE: frontend expects each entry as { name, center: [lat, lng] }.
NAGAR_PALIKAS_BY_DISTRICT = {
    "Lucknow": [
        {"name": "Lucknow Nagar Nigam", "center": [26.8467, 80.9462]},
        {"name": "Bakshi Ka Talab", "center": [26.98333, 80.88333]},
        {"name": "Banthra", "center": [26.693327, 80.834622]},
        {"name": "Amethi", "center": [26.76, 81.15]},
    ],
}


@router.get("/")
def list_municipalities(district: Optional[str] = Query(None, description="District name, e.g. 'Lucknow'")):
    """
    Returns nagar palikas/municipalities for a district, shaped as
    { name, center: [lat, lng] } to match the frontend's expectations.
    Currently hardcoded for the prototype — no DB table yet.
    """
    if district is None:
        # No district given: return everything we have, flattened.
        all_palikas = []
        for d, palikas in NAGAR_PALIKAS_BY_DISTRICT.items():
            for p in palikas:
                all_palikas.append({**p, "district": d})
        return all_palikas

    return NAGAR_PALIKAS_BY_DISTRICT.get(district, [])