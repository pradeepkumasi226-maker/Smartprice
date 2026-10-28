import uuid
from sqlalchemy import Column, String, DateTime, Boolean, Integer
from datetime import datetime
from ...database import Base

class EmailVerificationOTP(Base):
    __tablename__ = "email_verification_otps"

    id = Column(String, primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    email = Column(String, nullable=False, index=True)
    otp_hash = Column(String(64), nullable=False, index=True)  # SHA-256 hash
    purpose = Column(String(32), nullable=False, index=True)   # "registration", "login", or "password_reset"
    expires_at = Column(DateTime, nullable=False, index=True)
    attempts = Column(Integer, default=0, nullable=False)
    max_attempts = Column(Integer, default=5, nullable=False)
    used = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
