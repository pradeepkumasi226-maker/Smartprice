from sqlalchemy import Column, String, Float, Integer, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from ...database import Base

class InventoryTransaction(Base):
    __tablename__ = "inventory_transactions"

    id = Column(String, primary_key=True, index=True)
    product_id = Column(String, ForeignKey("products.id"), nullable=False, index=True)
    transaction_type = Column(String, nullable=False)  # RESTOCK, SALE, ADJUSTMENT
    quantity = Column(Integer, nullable=False)
    previous_stock = Column(Integer, nullable=False)
    new_stock = Column(Integer, nullable=False)
    unit_cost = Column(Float, nullable=False, default=0.0)
    reference = Column(String, nullable=True)
    user = Column(String, default="Retail Operations Manager")
    notes = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationship
    product = relationship("Product", back_populates="inventory_transactions")

