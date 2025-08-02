from fastapi import FastAPI, Request, HTTPException
from app.schemas import WallRequest
from app.planner import generate_coverage_path
from app.database import engine
from app import models
from fastapi import Depends
from sqlalchemy.orm import Session
from app import models, database
import json
import datetime
import time
import logging


def get_db():
    db = database.SessionLocal()
    try:
        yield db
    finally:
        db.close()

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(message)s")


app = FastAPI()
models.Base.metadata.create_all(bind=engine)

@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.time()
    
    response = await call_next(request)
    
    duration = time.time() - start_time
    formatted_duration = f"{duration:.4f}s"

    logging.info(
        f"{request.method} {request.url.path} "
        f"completed in {formatted_duration} "
        f"status={response.status_code}"
    )

    return response

@app.get("/")
def root():
    return {"message": "Wall Coverage API running"}

@app.delete("/trajectory/{trajectory_id}")
def delete_trajectory(trajectory_id: int, db: Session = Depends(get_db)):
    traj = db.query(models.Trajectory).filter(models.Trajectory.id == trajectory_id).first()
    if not traj:
        raise HTTPException(status_code=404, detail="Trajectory not found")

    db.delete(traj)
    db.commit()
    return {"detail": f"Trajectory {trajectory_id} deleted successfully"}

@app.get("/trajectories/filter/")
def filter_trajectories(width: float = None, height: float = None, db: Session = Depends(get_db)):
    query = db.query(models.Trajectory)
    if width is not None:
        query = query.filter(models.Trajectory.width == width)
    if height is not None:
        query = query.filter(models.Trajectory.height == height)

    return [
        {
            "id": t.id,
            "name": t.name,
            "width": t.width,
            "height": t.height,
            "point_count": len(json.loads(t.points)),
            "total_length_m": t.total_length_m
        }
        for t in query.all()
    ]


@app.get("/trajectory/{trajectory_id}")
def get_trajectory(trajectory_id: int, db: Session = Depends(get_db)):
    trajectory = db.query(models.Trajectory).filter(models.Trajectory.id == trajectory_id).first()
    if not trajectory:
        raise HTTPException(status_code=404, detail="Trajectory not found")

    return {
        "id": trajectory.id,
        "name": trajectory.name,
        "width": trajectory.width,
        "height": trajectory.height,
        "points": json.loads(trajectory.points)
    }

@app.post("/plan")
def generate_plan(req: WallRequest, db: Session = Depends(get_db)):
    path = generate_coverage_path(req.width, req.height, obstacles=req.obstacles)

    trajectory = models.Trajectory(
        name=f"run_{datetime.datetime.now().isoformat()}",
        width=req.width,
        height=req.height,
        points=json.dumps(path),
        total_length_m=calculate_length(path)
    )

    db.add(trajectory)
    db.commit()
    db.refresh(trajectory)

    return {
        "trajectory_id": trajectory.id,
        "path_preview": path[:10],
        "total_points": len(path)
    }


def calculate_length(path: list[tuple]) -> float:
    if len(path) < 2:
        return 0.0
    return sum(
        ((path[i][0] - path[i - 1][0])**2 + (path[i][1] - path[i - 1][1])**2)**0.5
        for i in range(1, len(path))
    )

def generate_plan(req: WallRequest, db: Session = Depends(get_db)):
    path = generate_coverage_path(req.width, req.height, obstacles=req.obstacles)


    trajectory = models.Trajectory(
        name=f"run_{datetime.datetime.now().isoformat()}",
        width=req.width,
        height=req.height,
        points=json.dumps(path),
        total_length_m=calculate_length(path)
    )


    db.add(trajectory)
    db.commit()
    db.refresh(trajectory)

    return {
        "trajectory_id": trajectory.id,
        "path_preview": path[:10],
        "total_points": len(path)
    }
@app.get("/trajectories")
def list_trajectories(db: Session = Depends(get_db)):
    results = db.query(models.Trajectory).all()
    return [
        {
            "id": traj.id,
            "name": traj.name,
            "width": traj.width,
            "height": traj.height,
            "point_count": len(json.loads(traj.points))
        }
        for traj in results
    ]
