from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()

# Hardcoded users for MVP demo — replace with real auth later if time permits
DEMO_USERS = {
    "citizen": {"password": "citizen123", "role": "citizen"},
    "officer": {"password": "officer123", "role": "officer"},
}


class LoginRequest(BaseModel):
    username: str
    password: str


@router.post("/login")
def login(data: LoginRequest):
    """
    Simple hardcoded login for MVP.
    Returns the role so frontend knows which view to show.
    """
    user = DEMO_USERS.get(data.username)
    if not user or user["password"] != data.password:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    return {
        "username": data.username,
        "role": user["role"],
        "message": f"Logged in as {user['role']}"
    }