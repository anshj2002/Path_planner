from app.database import Base
from sqlalchemy import Column, Integer, String, Float, DateTime, Index
from datetime import datetime


class Trajectory(Base):
    __tablename__ = "trajectories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    width = Column(Float, index=True)
    height = Column(Float, index=True)
    points = Column(String)  # JSON-encoded list of (x, y)
    total_length_m = Column(Float)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    __table_args__ = (
        Index("ix_dimensions", "width", "height"),
    )
