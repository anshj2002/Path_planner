from fastapi import FastAPI
from app.schemas import WallRequest
from app.planner import generate_coverage_path
from app.database import engine
from app import models
from fastapi import Depends
from sqlalchemy.orm import Session
from app import models, database
import json
import datetime

def get_db():
    db = database.SessionLocal()
    try:
        yield db
    finally:
        db.close()


app = FastAPI()
models.Base.metadata.create_all(bind=engine)


@app.get("/")
def root():
    return {"message": "Wall Coverage API running"}

@app.post("/plan")
def generate_plan(req: WallRequest, db: Session = Depends(get_db)):
    path = generate_coverage_path(req.width, req.height)

    trajectory = models.Trajectory(
        name=f"run_{datetime.datetime.now().isoformat()}",
        width=req.width,
        height=req.height,
        points=json.dumps(path)  # Convert list of tuples to JSON string
    )

    db.add(trajectory)
    db.commit()
    db.refresh(trajectory)

    return {
        "trajectory_id": trajectory.id,
        "path_preview": path[:10],
        "total_points": len(path)
    }
