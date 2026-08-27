from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes import incidents, auth, analytics
from app.db import close_pool

app = FastAPI(title="SIH 2026 - Civic Issue Tracker")

# Allow frontend to call this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "https://sih-2026-project-rho.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routes
app.include_router(incidents.router, prefix="/incidents", tags=["Incidents"])
app.include_router(auth.router, prefix="/auth", tags=["Auth"])
app.include_router(analytics.router, prefix="/analytics", tags=["Analytics"])


@app.get("/")
def root():
    return {"message": "SIH 2026 backend is running 🚀"}


@app.on_event("shutdown")
def shutdown_event():
    close_pool()