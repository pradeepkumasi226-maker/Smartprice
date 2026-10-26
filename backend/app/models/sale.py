from sqlalchemy import Column, String, Float, Integer, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from ...database import Base

class Sale(Base):
    __tablename__ = "sales"

    id = Column(String, primary_key=True, index=True)
    product_id = Column(String, ForeignKey("products.id"), nullable=False, index=True)
    store = Column(String, default="Downtown Flagship (Store #104)")
    sale_date = Column(String, nullable=False, index=True)  # YYYY-MM-DD
    quantity = Column(Integer, nullable=False, default=1)
    selling_price = Column(Float, nullable=False)
    revenue = Column(Float, nullable=False)
    cost = Column(Float, nullable=False)
    profit = Column(Float, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationship
    product = relationship("Product", back_populates="sales")
