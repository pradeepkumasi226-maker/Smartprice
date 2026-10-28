import os
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

from typing import Optional

import secrets
import logging

from dotenv import load_dotenv

logger = logging.getLogger("smartprice.config")

BACKEND_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BACKEND_DIR.parent
DATA_DIR = BACKEND_DIR / "data"
DATA_DIR.mkdir(exist_ok=True)

BACKEND_ENV_PATH = BACKEND_DIR / ".env"
ROOT_ENV_PATH = PROJECT_ROOT / ".env"

def reload_environment():
    """
    Reloads environment variables from project .env and backend/.env using absolute paths.
    Ensures running applications, tests, and CLI scripts pick up modified credentials immediately.
    """
    if ROOT_ENV_PATH.is_file():
        load_dotenv(ROOT_ENV_PATH)
    if BACKEND_ENV_PATH.is_file():
        load_dotenv(BACKEND_ENV_PATH, override=True)

# Explicitly load local environment configurations at module import
reload_environment()

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
    OTP_RESEND_COOLDOWN_SECONDS: int = 60

    # Gmail SMTP Configuration
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USERNAME: Optional[str] = None
    SMTP_APP_PASSWORD: Optional[str] = None
    SMTP_FROM_EMAIL: Optional[str] = None

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

    def refresh_from_env(self) -> None:
        """
        Dynamically refreshes settings from project and backend .env files.
        Ensures running processes immediately detect credential edits without server restarts.
        """
        reload_environment()
        self.SMTP_HOST = os.getenv("SMTP_HOST", self.SMTP_HOST)
        try:
            self.SMTP_PORT = int(os.getenv("SMTP_PORT", str(self.SMTP_PORT)))
        except (ValueError, TypeError):
            pass
        self.SMTP_USERNAME = os.getenv("SMTP_USERNAME", self.SMTP_USERNAME)
        self.SMTP_APP_PASSWORD = os.getenv("SMTP_APP_PASSWORD", self.SMTP_APP_PASSWORD)
        self.SMTP_FROM_EMAIL = os.getenv("SMTP_FROM_EMAIL", self.SMTP_FROM_EMAIL)

    def get_smtp_config(self) -> dict:
        """
        Returns clean, dynamically loaded SMTP settings.
        Handles leading/trailing whitespaces and empty strings safely.
        """
        self.refresh_from_env()
        raw_user = (self.SMTP_USERNAME or "").strip()
        raw_pwd = (self.SMTP_APP_PASSWORD or "").strip()
        raw_from = (self.SMTP_FROM_EMAIL or "").strip() or raw_user

        return {
            "host": self.SMTP_HOST,
            "port": self.SMTP_PORT,
            "username": raw_user if raw_user else None,
            "password": raw_pwd if raw_pwd else None,
            "from_email": raw_from if raw_from else None,
            "loaded_from": str(BACKEND_ENV_PATH if BACKEND_ENV_PATH.is_file() else ROOT_ENV_PATH),
            "backend_env_exists": BACKEND_ENV_PATH.is_file(),
            "root_env_exists": ROOT_ENV_PATH.is_file(),
        }

    model_config = SettingsConfigDict(
        env_file=[str(ROOT_ENV_PATH), str(BACKEND_ENV_PATH)],
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()

