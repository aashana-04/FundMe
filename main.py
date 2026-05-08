"""
FundMe FastAPI Application Entry Point.
Run with:  uvicorn backend.main:app --reload --port 8000
"""

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from backend.database import engine, Base, SessionLocal

from backend.routes.onboarding import router as onboarding_router
from backend.routes.ai import router as ai_router
from backend.routes.opportunities import router as opportunities_router
from backend.routes.auth import router as auth_router
from backend.routes.profile import router as profile_router

from backend.services.ingestion_service import (
    start_scheduled_refresh,
    stop_scheduled_refresh,
)

# Frontend directory (one level up from backend/)
FRONTEND_DIR = Path(__file__).resolve().parent.parent


@asynccontextmanager
async def lifespan(app: FastAPI):

    # Import models so SQLAlchemy knows about them before create_all
    import backend.models.onboarding      # noqa: F401
    import backend.models.opportunities   # noqa: F401
    import backend.models.auth            # noqa: F401  ← new auth + profile models

    Base.metadata.create_all(bind=engine)
    print("[OK] Database tables ready.")

    def db_factory():
        return SessionLocal()

    start_scheduled_refresh(db_factory, interval_seconds=7200)
    print("[OK] Opportunity refresh scheduler started.")

    yield

    stop_scheduled_refresh()
    print("[--] Server shutting down.")


app = FastAPI(
    title="FundMe API",
    description="AI-native Founder Opportunity Intelligence System.",
    version="3.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Existing routes (preserved) ──
app.include_router(onboarding_router, prefix="/api/v1")
app.include_router(ai_router, prefix="/api/v1")
app.include_router(opportunities_router, prefix="/api/v1")

# ── New MVP routes ──
app.include_router(auth_router, prefix="/api/v1")
app.include_router(profile_router, prefix="/api/v1")


@app.get("/health", tags=["Health"])
def health_check():
    return {"status": "ok", "service": "FundMe API", "version": "3.0.0"}


# ── Static file serving ──
app.mount("/js", StaticFiles(directory=str(FRONTEND_DIR / "js")), name="js")
app.mount("/styles", StaticFiles(directory=str(FRONTEND_DIR / "styles")), name="styles")


@app.get("/", tags=["Root"])
def serve_frontend():
    """Serve the frontend index.html."""
    index_path = FRONTEND_DIR / "index.html"
    if index_path.exists():
        return FileResponse(str(index_path), media_type="text/html")
    return {"message": "FundMe API", "docs": "/docs"}