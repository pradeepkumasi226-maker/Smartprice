from sqlalchemy import Column, String, DateTime
from datetime import datetime
from ...database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    identifier = Column(String, unique=True, index=True, nullable=False)  # email or phone
    password_hash = Column(String(255), nullable=True)
    password_changed_at = Column(DateTime, nullable=True)
    role = Column(String, default="Retail Pricing Manager")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
