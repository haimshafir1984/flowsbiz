from fastapi import APIRouter
from datetime import datetime
from app.core.config import settings

router = APIRouter()

@router.get("")
def check_health():
    """
    Health check endpoint to verify that the FastAPI backend is operational.
    """
    return {
        "status": "healthy",
        "app_name": settings.APP_NAME,
        "environment": settings.APP_ENV,
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "debug_mode": settings.DEBUG
    }
