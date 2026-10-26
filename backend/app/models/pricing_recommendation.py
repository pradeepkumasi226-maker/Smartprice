from sqlalchemy import Column, String, Float, Integer, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from ...database import Base

class PricingRecommendation(Base):
    __tablename__ = "pricing_recommendations"

    id = Column(String, primary_key=True, index=True)
    product_id = Column(String, ForeignKey("products.id"), nullable=False, index=True)
    recommended_price = Column(Float, nullable=False)
    expected_demand = Column(Integer, nullable=False)
    expected_revenue = Column(Float, nullable=False)
    expected_margin = Column(String, nullable=False)  # e.g., "48.5%"
    reason = Column(String, nullable=True)
    status = Column(String, default="Pending Approval")  # Pending Approval, Approved, Declined
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationship
    product = relationship("Product", back_populates="pricing_recommendations")
