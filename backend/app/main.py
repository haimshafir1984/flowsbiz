from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.api.v1 import campaigns, contacts, webhooks
from app.adapters.database.connection import engine
from app.adapters.database.models import Base

app = FastAPI(
    title=settings.APP_NAME,
    description="Hexagonal Architecture (Ports & Adapters) WhatsApp Campaign Engine with Multi-Tenant design",
    version="1.0.0",
    debug=settings.DEBUG,
)

@app.on_event("startup")
async def startup_event():
    # Automatically create tables in local SQLite database on startup
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

# Set up CORS middleware
origins = [origin.strip() for origin in settings.ALLOWED_ORIGINS.split(",") if origin.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include v1 REST Routers
app.include_router(campaigns.router, prefix="/api/v1/campaigns", tags=["Campaigns"])
app.include_router(contacts.router, prefix="/api/v1/contacts", tags=["Contacts"])
app.include_router(webhooks.router, prefix="/api/v1/webhooks", tags=["Meta Webhooks"])

@app.get("/api/v1/health")
def get_health():
    """
    Healthcheck endpoint to verify operational connectivity
    """
    return {
        "status": "healthy",
        "app_name": settings.APP_NAME,
        "environment": settings.APP_ENV
    }

@app.get("/")
def read_root():
    return {
        "message": f"Welcome to the Hexagonal {settings.APP_NAME}",
        "documentation": "/docs",
        "health": "/api/v1/health"
    }
