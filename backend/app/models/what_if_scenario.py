from sqlalchemy import Column, String, Float, Integer, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from ...database import Base

class WhatIfScenario(Base):
    __tablename__ = "what_if_scenarios"

    id = Column(String, primary_key=True, index=True)
    product_id = Column(String, ForeignKey("products.id"), nullable=False, index=True)
    name = Column(String, nullable=False)
    current_price = Column(Float, nullable=False)
    simulated_price = Column(Float, nullable=False)
    expected_demand = Column(Integer, nullable=False)
    expected_revenue = Column(Float, nullable=False)
    expected_margin = Column(String, nullable=False)
    expected_gross_profit = Column(Float, nullable=False)
    status = Column(String, default="Staged Draft")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationship
    product = relationship("Product", back_populates="what_if_scenarios")
