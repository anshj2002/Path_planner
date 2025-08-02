document.getElementById("planner-form").addEventListener("submit", async (e) => {
    e.preventDefault();

    const width = parseFloat(document.getElementById("width").value);
    const height = parseFloat(document.getElementById("height").value);
    let obstacles = [];

    const obstacleText = document.getElementById("obstacles").value.trim();
    if (obstacleText) {
        try {
            obstacles = JSON.parse(obstacleText);
        } catch (err) {
            alert("Invalid JSON format for obstacles");
            return;
        }
    }

    const payload = {
        width,
        height,
        obstacles
    };

    try {
        const response = await fetch("http://localhost:8000/plan", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error("API error");
        }

        const result = await response.json();
        document.getElementById("result").innerText = `Trajectory ID: ${result.trajectory_id}\nTotal Points: ${result.total_points}\nPreview:\n${JSON.stringify(result.path_preview)}`;
    } catch (error) {
        document.getElementById("result").innerText = "Error contacting API: " + error.message;
    }
});
