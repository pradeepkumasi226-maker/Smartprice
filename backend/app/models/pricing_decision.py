from sqlalchemy import Column, String, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from ...database import Base

class PricingDecision(Base):
    __tablename__ = "pricing_decisions"

    id = Column(String, primary_key=True, index=True)
    product_id = Column(String, ForeignKey("products.id"), nullable=False, index=True)
    previous_price = Column(Float, nullable=False)
    approved_price = Column(Float, nullable=False)
    decision = Column(String, nullable=False)  # APPROVED, REJECTED, OVERRIDDEN
    user = Column(String, default="Retail Pricing Manager")
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationship
    product = relationship("Product", back_populates="pricing_decisions")
