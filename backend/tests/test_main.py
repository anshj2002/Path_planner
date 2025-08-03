from fastapi.testclient import TestClient
from app.main import app

import json

client = TestClient(app)

def test_root_endpoint():
    """Test the root endpoint"""
    response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {"message": "Wall Coverage API running"}

def test_plan_and_get_trajectory_no_obstacles():
    """Test creating a plan without obstacles and retrieving it"""
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
    
    # Get the trajectory
    response = client.get(f"/trajectory/{traj_id}")
    assert response.status_code == 200
    traj_data = response.json()
    assert traj_data["width"] == 2.0
    assert traj_data["height"] == 2.0
    assert isinstance(traj_data["points"], list)
    assert isinstance(traj_data["obstacles"], list)
    assert len(traj_data["obstacles"]) == 0

def test_plan_with_obstacles():
    """Test creating a plan with obstacles"""
    response = client.post("/plan", json={
        "width": 5.0,
        "height": 5.0,
        "obstacles": [
            {
                "x": 1.0,
                "y": 1.0,
                "width": 1.0,
                "height": 1.0
            },
            {
                "x": 3.0,
                "y": 3.0,
                "width": 0.5,
                "height": 0.5
            }
        ]
    })
    assert response.status_code == 200
    data = response.json()
    assert "trajectory_id" in data
    assert "path_preview" in data
    assert "total_points" in data
    
    traj_id = data["trajectory_id"]
    
    # Get the trajectory and verify obstacles are stored
    response = client.get(f"/trajectory/{traj_id}")
    assert response.status_code == 200
    traj_data = response.json()
    assert len(traj_data["obstacles"]) == 2
    assert traj_data["obstacles"][0]["x"] == 1.0
    assert traj_data["obstacles"][0]["y"] == 1.0

def test_list_trajectories():
    """Test listing all trajectories"""
    # First create a trajectory
    client.post("/plan", json={
        "width": 3.0,
        "height": 3.0,
        "obstacles": []
    })
    
    response = client.get("/trajectories")
    assert response.status_code == 200
    trajectories = response.json()
    assert isinstance(trajectories, list)
    assert len(trajectories) > 0
    
    # Check structure of trajectory list items
    traj = trajectories[0]
    assert "id" in traj
    assert "name" in traj
    assert "width" in traj
    assert "height" in traj
    assert "point_count" in traj

def test_filter_trajectories():
    """Test filtering trajectories by dimensions"""
    # Create trajectories with different dimensions
    client.post("/plan", json={"width": 2.0, "height": 2.0, "obstacles": []})
    client.post("/plan", json={"width": 3.0, "height": 3.0, "obstacles": []})
    client.post("/plan", json={"width": 2.0, "height": 4.0, "obstacles": []})
    
    # Filter by width only
    response = client.get("/trajectories/filter/?width=2.0")
    assert response.status_code == 200
    filtered = response.json()
    assert isinstance(filtered, list)
    for traj in filtered:
        assert traj["width"] == 2.0
    
    # Filter by height only
    response = client.get("/trajectories/filter/?height=3.0")
    assert response.status_code == 200
    filtered = response.json()
    for traj in filtered:
        assert traj["height"] == 3.0
    
    # Filter by both width and height
    response = client.get("/trajectories/filter/?width=2.0&height=2.0")
    assert response.status_code == 200
    filtered = response.json()
    for traj in filtered:
        assert traj["width"] == 2.0
        assert traj["height"] == 2.0

def test_get_nonexistent_trajectory():
    """Test getting a trajectory that doesn't exist"""
    response = client.get("/trajectory/99999")
    assert response.status_code == 404
    assert "Trajectory not found" in response.json()["detail"]

def test_delete_trajectory():
    """Test deleting a trajectory"""
    # First create a trajectory
    response = client.post("/plan", json={
        "width": 1.0,
        "height": 1.0,
        "obstacles": []
    })
    traj_id = response.json()["trajectory_id"]
    
    # Delete it
    response = client.delete(f"/trajectory/{traj_id}")
    assert response.status_code == 200
    assert f"Trajectory {traj_id} deleted successfully" in response.json()["detail"]
    
    # Verify it's gone
    response = client.get(f"/trajectory/{traj_id}")
    assert response.status_code == 404

def test_delete_nonexistent_trajectory():
    """Test deleting a trajectory that doesn't exist"""
    response = client.delete("/trajectory/99999")
    assert response.status_code == 404
    assert "Trajectory not found" in response.json()["detail"]

def test_invalid_plan_request():
    """Test creating a plan with invalid data"""
    # Missing required fields
    response = client.post("/plan", json={
        "width": 2.0
        # Missing height and obstacles
    })
    assert response.status_code == 422  # Validation error
    
    # Invalid obstacle structure
    response = client.post("/plan", json={
        "width": 2.0,
        "height": 2.0,
        "obstacles": [
            {
                "x": 1.0,
                "y": 1.0
                # Missing width and height
            }
        ]
    })
    assert response.status_code == 422

def test_path_generation_logic():
    """Test that the path generation produces reasonable results"""
    response = client.post("/plan", json={
        "width": 2.0,
        "height": 2.0,
        "obstacles": []
    })
    assert response.status_code == 200
    
    traj_id = response.json()["trajectory_id"]
    response = client.get(f"/trajectory/{traj_id}")
    
    traj_data = response.json()
    points = traj_data["points"]
    
    # Check that we have points
    assert len(points) > 0
    
    # Check that all points are within bounds
    for point in points:
        assert 0 <= point[0] <= 2.0
        assert 0 <= point[1] <= 2.0
    
    # Check that points are properly formatted
    for point in points:
        assert len(point) == 2  # x, y coordinates
        assert isinstance(point[0], (int, float))
        assert isinstance(point[1], (int, float))

def test_obstacle_avoidance():
    
    response = client.post("/plan", json={
        "width": 3.0,
        "height": 3.0,
        "obstacles": [
            {
                "x": 1.0,
                "y": 1.0,
                "width": 1.0,
                "height": 1.0
            }
        ]
    })
    assert response.status_code == 200
    
    traj_id = response.json()["trajectory_id"]
    response = client.get(f"/trajectory/{traj_id}")
    
    traj_data = response.json()
    points = traj_data["points"]
    
    # Check that no points are inside the obstacle area
    obstacle = traj_data["obstacles"][0]
    for point in points:
        x, y = point[0], point[1]
        # Point should not be inside obstacle bounds
        assert not (obstacle["x"] <= x <= obstacle["x"] + obstacle["width"] and
                   obstacle["y"] <= y <= obstacle["y"] + obstacle["height"])