from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_plan_and_get_trajectory():
    
    response = client.post("/plan", json={
        "width": 2.0,
        "height": 2.0,
        "obstacles": []
    })
    assert response.status_code == 200
    data = response.json()
    assert "trajectory_id" in data
    assert "path_preview" in data
    assert "total_points" in data
    traj_id = data["trajectory_id"]

    
    response = client.get(f"/trajectory/{traj_id}")
    assert response.status_code == 200
    traj_data = response.json()
    assert traj_data["width"] == 2.0
    assert traj_data["height"] == 2.0
    assert isinstance(traj_data["points"], list)

def test_list_trajectories():
    response = client.get("/trajectories")
    assert response.status_code == 200
    assert isinstance(response.json(), list)
