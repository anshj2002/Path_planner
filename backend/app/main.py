from fastapi import FastAPI
from app.schemas import WallRequest
from app.planner import generate_coverage_path


app = FastAPI()

@app.get("/")
def root():
    return {"message": "Wall Coverage API running"}

@app.post("/plan")
def generate_plan(req: WallRequest):
    path = generate_coverage_path(req.width, req.height)
    return {
        "path_preview": path[:10],
        "total_points": len(path)
    }
