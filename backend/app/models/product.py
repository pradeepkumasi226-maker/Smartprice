from sqlalchemy import Column, String, Float, Integer, DateTime, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
from ...database import Base

class Product(Base):
    __tablename__ = "products"

    id = Column(String, primary_key=True, index=True)
    sku = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    category = Column(String, index=True, nullable=False)
    current_price = Column(Float, nullable=False)
    cost_price = Column(Float, nullable=False)
    competitor_price = Column(Float, nullable=True, default=0.0)
    stock_quantity = Column(Integer, nullable=False, default=0)
    reorder_level = Column(Integer, nullable=False, default=30)
    safety_stock = Column(Integer, nullable=False, default=15)
    supplier = Column(String, default="Global Direct Vendor Ltd.")
    rating = Column(Float, default=4.5)
    elasticity = Column(Float, default=-1.25)
    predicted_demand = Column(Integer, default=100)
    dynamic_pricing = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    sales = relationship("Sale", back_populates="product", cascade="all, delete-orphan")
    inventory_transactions = relationship("InventoryTransaction", back_populates="product", cascade="all, delete-orphan")
    pricing_recommendations = relationship("PricingRecommendation", back_populates="product", cascade="all, delete-orphan")
    pricing_decisions = relationship("PricingDecision", back_populates="product", cascade="all, delete-orphan")
    what_if_scenarios = relationship("WhatIfScenario", back_populates="product", cascade="all, delete-orphan")
    forecasts = relationship("Forecast", back_populates="product", cascade="all, delete-orphan")
    shap_explanations = relationship("ShapExplanation", back_populates="product", cascade="all, delete-orphan")
