import os
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

from typing import Optional

import secrets
import logging

logger = logging.getLogger("smartprice.config")

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(exist_ok=True)

class Settings(BaseSettings):
    PROJECT_NAME: str = "SmartPrice AI Retail Engine"
    ENVIRONMENT: str = os.getenv("SMARTPRICE_ENV", os.getenv("ENVIRONMENT", "development"))
    DATABASE_URL: str = f"sqlite:///{DATA_DIR / 'smartprice.db'}"
    FRONTEND_URL: str = "http://localhost:3000"
    ALLOWED_ORIGINS: Optional[str] = None
    SESSION_SECRET: str = "smartprice-retail-xai-session-key-2026"
    JWT_SECRET_KEY: str = "smartprice-retail-xai-session-key-2026"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440
    OTP_EXPIRY_MINUTES: int = 5
    OTP_LENGTH: int = 6
    MAX_OTP_ATTEMPTS: int = 5
    OTP_RESEND_COOLDOWN_SECONDS: int = 30

    LOGIN_RATE_LIMIT_MAX_ATTEMPTS: int = 5
    LOGIN_RATE_LIMIT_WINDOW_SECONDS: int = 60

    def validate_production_secrets(self) -> None:
        """
        Validates production configuration at application startup:
        - Fails safely if running in production without a persistent, strong JWT_SECRET_KEY.
        - Refuses missing, empty, or default development placeholder secrets.
        - Keeps local development configuration seamlessly usable.
        """
        dev_default = "smartprice-retail-xai-session-key-2026"
        secret = (self.JWT_SECRET_KEY or "").strip()
        if self.ENVIRONMENT == "production":
            if not secret or secret == dev_default or len(secret) < 32:
                raise RuntimeError(
                    "FATAL SECURITY CONFIGURATION: In production mode (ENVIRONMENT='production'), "
                    "a persistent, high-entropy JWT_SECRET_KEY (>= 32 characters) must be supplied via the environment. "
                    "Startup has failed safely to prevent running with insecure or transient secrets."
                )

    def get_jwt_secret(self) -> str:
        """
        Returns the persistent JWT secret key.
        In production, verifies that an environment-supplied persistent key exists.
        In development or testing, permits the standard development key.
        """
        self.validate_production_secrets()
        return self.JWT_SECRET_KEY

    # Unified SMS Provider Configuration
    # Supported: "fast2sms", "twilio", "msg91", "custom", "mock"
    SMS_PROVIDER: str = "fast2sms"
    SMS_API_KEY: Optional[str] = None
    SMS_API_SECRET: Optional[str] = None
    SMS_SENDER_ID: Optional[str] = "SMPRCE"
    SMS_SERVICE_ID: Optional[str] = None

    # Provider-specific direct aliases (optional)
    FAST2SMS_API_KEY: Optional[str] = None
    TWILIO_ACCOUNT_SID: Optional[str] = None
    TWILIO_AUTH_TOKEN: Optional[str] = None
    TWILIO_PHONE_NUMBER: Optional[str] = None
    MSG91_AUTH_KEY: Optional[str] = None
    MSG91_TEMPLATE_ID: Optional[str] = None
    MSG91_SENDER_ID: Optional[str] = "SMPRCE"
    SMS_GATEWAY_URL: Optional[str] = None
    SMS_GATEWAY_API_KEY: Optional[str] = None

    model_config = SettingsConfigDict(
        env_file=[BASE_DIR.parent / ".env", BASE_DIR / ".env"],
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()

