from sqlalchemy import Column, String, DateTime, Boolean
from datetime import datetime
from ...database import Base

class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, nullable=False, index=True)
    token_hash = Column(String(64), unique=True, nullable=False, index=True)  # SHA-256 hash
    expires_at = Column(DateTime, nullable=False, index=True)
    used = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
