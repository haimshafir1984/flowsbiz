from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    APP_NAME: str = "WhatsApp Campaign Engine"
    APP_ENV: str = "development"
    DEBUG: bool = True
    
    # Infrastructure Connections
    DATABASE_URL: str = "sqlite+aiosqlite:///./whatsapp_db.sqlite"
    REDIS_URL: str = "redis://127.0.0.1:6379/0"
    
    # Meta Webhook Verification token
    META_VERIFY_TOKEN: str = "flowsbiz_meta_secure_verification_token_2026"
    
    # Server configuration
    HOST: str = "127.0.0.1"
    PORT: int = 8000
    
    # CORS Configuration
    ALLOWED_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173"

    model_config = SettingsConfigDict(
        env_file=".env", 
        env_file_encoding="utf-8", 
        extra="ignore"
    )

settings = Settings()
