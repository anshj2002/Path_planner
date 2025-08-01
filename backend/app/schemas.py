from pydantic import BaseModel
from typing import List

class Obstacle(BaseModel):
    x: float
    y: float
    width: float
    height: float

class WallRequest(BaseModel):
    width: float
    height: float
    obstacles: List[Obstacle]
