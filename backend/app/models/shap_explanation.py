from sqlalchemy import Column, String, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from ...database import Base

class ShapExplanation(Base):
    __tablename__ = "shap_explanations"

    id = Column(String, primary_key=True, index=True)
    product_id = Column(String, ForeignKey("products.id"), nullable=False, index=True)
    feature_name = Column(String, nullable=False)
    feature_value = Column(String, nullable=True)
    shap_value = Column(Float, nullable=False)
    direction = Column(String, default="positive")  # positive, negative
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationship
    product = relationship("Product", back_populates="shap_explanations")
