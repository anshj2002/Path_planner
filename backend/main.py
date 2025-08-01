from fastapi import FastAPI
from pydantic import BaseModel
from typing import List


app = FastAPI()

class Obstacle(BaseModel):
    x: float
    y: float
    width: float
    height: float

class WallRequest(BaseModel):
    width: float
    height: float
    obstacles: List[Obstacle]


@app.get("/")
def root():
    return {"initial"}

@app.post("/plan")
def generate_plan(req: WallRequest):
    return {
        "wall_width": req.width,
        "wall_height": req.height,
        "obstacle_count": len(req.obstacles),
        "obstacles": req.obstacles
    }