from sqlalchemy import Column, String, Float, Integer, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from ...database import Base

class Forecast(Base):
    __tablename__ = "forecasts"

    id = Column(String, primary_key=True, index=True)
    product_id = Column(String, ForeignKey("products.id"), nullable=False, index=True)
    forecast_date = Column(String, nullable=False, index=True)  # YYYY-MM-DD or date label
    predicted_demand = Column(Integer, nullable=False)
    lower_bound = Column(Integer, nullable=False)
    upper_bound = Column(Integer, nullable=False)
    model_name = Column(String, default="NeuralProphet + XGBoost Ensemble v2.4")
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationship
    product = relationship("Product", back_populates="forecasts")
