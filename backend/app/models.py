from sqlalchemy import Column, Integer, String, Float
from app.database import Base

class Trajectory(Base):
    __tablename__ = "trajectories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True) 
    width = Column(Float)
    height = Column(Float)
    points = Column(String)
