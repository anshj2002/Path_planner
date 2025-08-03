// Configuration
const CONFIG = {
    baseURL: "http://localhost:8000",
    colors: {
        wall: "#2d3748",
        obstacle: "#e53e3e", 
        path: "#3182ce",
        robot: "#48bb78",
        background: "#f8f9fa"
    }
};

// Global variables
let currentPath = [];
let currentObstacles = [];
let wallDimensions = { width: 0, height: 0 };
let animationId = null;
let currentPointIndex = 0;
let isPlaying = false;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    setupEventListeners();
    loadSavedTrajectories();
});

function setupEventListeners() {
    // Form submission - CRITICAL FIX: Prevent default and use proper event handling
    const form = document.getElementById('wall-form');
    if (form) {
        form.addEventListener('submit', function(event) {
            event.preventDefault();
            event.stopPropagation();
            handleFormSubmit(event);
        });
    }

    // Playback controls
    const playBtn = document.getElementById('play-btn');
    const pauseBtn = document.getElementById('pause-btn');
    const resetBtn = document.getElementById('reset-btn');
    const progressSlider = document.getElementById('progress-slider');
    
    if (playBtn) playBtn.addEventListener('click', startPlayback);
    if (pauseBtn) pauseBtn.addEventListener('click', pausePlayback);
    if (resetBtn) resetBtn.addEventListener('click', resetPlayback);
    if (progressSlider) progressSlider.addEventListener('input', handleProgressChange);

    // Trajectory management
    const loadBtn = document.getElementById('load-btn');
    const deleteBtn = document.getElementById('delete-btn');
    
    if (loadBtn) loadBtn.addEventListener('click', loadSelectedTrajectory);
    if (deleteBtn) deleteBtn.addEventListener('click', deleteSelectedTrajectory);
}

// MAIN FIX: Completely rewritten form submission handler
async function handleFormSubmit(event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    
    console.log("Form submitted - starting processing");
    
    // Disable submit button to prevent multiple submissions
    const submitBtn = document.querySelector('.generate-btn');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Generating...';
    }

    try {
        // Show loading first
        showLoading(true);
        
        // Get and validate form data
        const width = parseFloat(document.getElementById('width').value);
        const height = parseFloat(document.getElementById('height').value);
        const stripeWidth = parseFloat(document.getElementById('stripe-width')?.value) || 0.25;

        if (!width || !height || width <= 0 || height <= 0) {
            throw new Error('Please enter valid width and height values');
        }

        // Parse obstacles
        let obstacles = [];
        const obstaclesText = document.getElementById('obstacles').value.trim();
        if (obstaclesText) {
            try {
                obstacles = JSON.parse(obstaclesText);
            } catch (error) {
                throw new Error('Invalid obstacles JSON format. Please check your input.');
            }
        }

        console.log("Sending request:", { width, height, obstacles });

        // Send request to generate path
        const response = await fetch(`${CONFIG.baseURL}/plan`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                width: width,
                height: height, 
                obstacles: obstacles
            })
        });

        if (!response.ok) {
            throw new Error(`Failed to generate path: ${response.status} ${response.statusText}`);
        }

        const result = await response.json();
        console.log("Plan generated:", result);

        // Get trajectory details
        const trajectoryResponse = await fetch(`${CONFIG.baseURL}/trajectory/${result.trajectory_id}`);
        if (!trajectoryResponse.ok) {
            throw new Error(`Failed to get trajectory: ${trajectoryResponse.status}`);
        }

        const trajectory = await trajectoryResponse.json();
        console.log("Trajectory received:", trajectory);

        // CRITICAL: Hide loading BEFORE updating UI
        showLoading(false);
        
        // Small delay to ensure DOM is ready
        await new Promise(resolve => setTimeout(resolve, 100));

        // Update global state
        currentPath = trajectory.points || [];
        currentObstacles = obstacles || [];
        wallDimensions = { width: width, height: height };

        console.log("Updated global state - drawing visualization");

        // Draw visualization if we have valid data
        if (currentPath.length > 0) {
            drawVisualization();
            updateStatistics(trajectory);
            showAlgorithmExplanation(obstacles, stripeWidth);
            
            // Show playback controls
            const controls = document.getElementById('playback-controls');
            if (controls) {
                controls.classList.remove('hidden');
            }
            
            resetPlayback();
        }

        // Refresh trajectory list
        loadSavedTrajectories();
        
        console.log("Form processing completed successfully");

    } catch (error) {
        console.error('Error in handleFormSubmit:', error);
        alert('Error: ' + error.message);
        showLoading(false);
    } finally {
        // Re-enable submit button
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Generate Coverage Path';
        }
    }
}

// IMPROVED: Loading function that doesn't interfere with canvas
function showLoading(show) {
    const loading = document.getElementById('loading');
    const canvasContainer = document.querySelector('.canvas-container');
    
    console.log("showLoading:", show);
    
    if (show) {
        if (loading) loading.classList.remove('hidden');
        if (canvasContainer) {
            canvasContainer.style.opacity = '0.5';
            canvasContainer.style.pointerEvents = 'none';
        }
    } else {
        if (loading) loading.classList.add('hidden');
        if (canvasContainer) {
            canvasContainer.style.opacity = '1';
            canvasContainer.style.pointerEvents = 'auto';
        }
    }
}

// IMPROVED: Robust visualization drawing function
function drawVisualization() {
    const canvas = document.getElementById('canvas');
    if (!canvas) {
        console.error('Canvas element not found');
        return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
        console.error('Could not get canvas context');
        return;
    }

    if (!currentPath || currentPath.length === 0) {
        console.warn('No path data to draw');
        return;
    }

    if (!wallDimensions || wallDimensions.width <= 0 || wallDimensions.height <= 0) {
        console.warn('Invalid wall dimensions');
        return;
    }

    console.log("Drawing visualization:", currentPath.length, "points");

    // Clear canvas and reset transforms
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // Set background
    ctx.fillStyle = CONFIG.colors.background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Calculate scaling with margins
    const margin = 40;
    const availableWidth = canvas.width - 2 * margin;
    const availableHeight = canvas.height - 2 * margin;
    const scaleX = availableWidth / wallDimensions.width;
    const scaleY = availableHeight / wallDimensions.height;
    const scale = Math.min(scaleX, scaleY);

    // Helper function
    function toCanvasCoords(x, y) {
        return {
            x: margin + x * scale,
            y: margin + y * scale
        };
    }

    // Draw wall boundary
    ctx.strokeStyle = CONFIG.colors.wall;
    ctx.lineWidth = 3;
    ctx.setLineDash([]);
    const wallCorner = toCanvasCoords(0, 0);
    ctx.strokeRect(wallCorner.x, wallCorner.y, wallDimensions.width * scale, wallDimensions.height * scale);

    // Draw obstacles
    if (currentObstacles && currentObstacles.length > 0) {
        ctx.fillStyle = CONFIG.colors.obstacle;
        ctx.globalAlpha = 0.7;
        currentObstacles.forEach(obstacle => {
            const pos = toCanvasCoords(obstacle.x, obstacle.y);
            ctx.fillRect(pos.x, pos.y, obstacle.width * scale, obstacle.height * scale);
        });
        ctx.globalAlpha = 1.0;
    }

    // Draw path
    if (currentPath.length > 0) {
        ctx.strokeStyle = CONFIG.colors.path;
        ctx.lineWidth = 2;
        ctx.setLineDash([]);
        ctx.beginPath();

        currentPath.forEach((point, index) => {
            const pos = toCanvasCoords(point[0], point[1]);
            if (index === 0) {
                ctx.moveTo(pos.x, pos.y);
            } else {
                ctx.lineTo(pos.x, pos.y);
            }
        });
        ctx.stroke();

        // Draw start point (green)
        const startPos = toCanvasCoords(currentPath[0][0], currentPath[0][1]);
        ctx.fillStyle = '#48bb78';
        ctx.beginPath();
        ctx.arc(startPos.x, startPos.y, 6, 0, 2 * Math.PI);
        ctx.fill();

        // Draw end point (red)
        if (currentPath.length > 1) {
            const endPos = toCanvasCoords(
                currentPath[currentPath.length - 1][0], 
                currentPath[currentPath.length - 1][1]
            );
            ctx.fillStyle = '#e53e3e';
            ctx.beginPath();
            ctx.arc(endPos.x, endPos.y, 6, 0, 2 * Math.PI);
            ctx.fill();
        }

        // Draw direction arrows every 10th point
        ctx.fillStyle = CONFIG.colors.path;
        for (let i = 0; i < currentPath.length - 1; i += 10) {
            drawArrow(ctx, currentPath[i], currentPath[i + 1], scale, margin);
        }
    }

    console.log("Visualization drawn successfully");
}

// Arrow drawing helper
function drawArrow(ctx, from, to, scale, margin) {
    const fromPos = { 
        x: margin + from[0] * scale, 
        y: margin + from[1] * scale 
    };
    const toPos = { 
        x: margin + to[0] * scale, 
        y: margin + to[1] * scale 
    };
    
    const angle = Math.atan2(toPos.y - fromPos.y, toPos.x - fromPos.x);
    const arrowSize = 6;

    ctx.save();
    ctx.translate(toPos.x, toPos.y);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-arrowSize, -arrowSize/2);
    ctx.lineTo(-arrowSize, arrowSize/2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
}

// Robot position drawing for animation
function drawRobotPosition(pointIndex) {
    if (!currentPath || pointIndex >= currentPath.length || pointIndex < 0) {
        return;
    }

    // Redraw base visualization first
    drawVisualization();

    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');

    // Calculate scaling
    const margin = 40;
    const scale = Math.min(
        (canvas.width - 2 * margin) / wallDimensions.width,
        (canvas.height - 2 * margin) / wallDimensions.height
    );

    const point = currentPath[pointIndex];
    const pos = {
        x: margin + point[0] * scale,
        y: margin + point[1] * scale
    };

    // Draw robot as circle with outline
    ctx.fillStyle = CONFIG.colors.robot;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 8, 0, 2 * Math.PI);
    ctx.fill();

    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;
    ctx.stroke();
}

// Playback control functions
function startPlayback() {
    if (currentPath.length === 0) return;

    isPlaying = true;
    const playBtn = document.getElementById('play-btn');
    const pauseBtn = document.getElementById('pause-btn');
    
    if (playBtn) playBtn.classList.add('hidden');
    if (pauseBtn) pauseBtn.classList.remove('hidden');
    
    animateRobot();
}

function pausePlayback() {
    isPlaying = false;
    const playBtn = document.getElementById('play-btn');
    const pauseBtn = document.getElementById('pause-btn');
    
    if (playBtn) playBtn.classList.remove('hidden');
    if (pauseBtn) pauseBtn.classList.add('hidden');
    
    if (animationId) {
        clearTimeout(animationId);
    }
}

function resetPlayback() {
    pausePlayback();
    currentPointIndex = 0;
    updateProgressSlider();
    if (currentPath.length > 0) {
        drawRobotPosition(0);
    }
}

function handleProgressChange(event) {
    const progress = parseFloat(event.target.value);
    currentPointIndex = Math.floor((progress / 100) * (currentPath.length - 1));
    updateProgressInfo();
    if (currentPath.length > 0) {
        drawRobotPosition(currentPointIndex);
    }
}

function animateRobot() {
    if (!isPlaying || currentPointIndex >= currentPath.length) {
        pausePlayback();
        return;
    }

    drawRobotPosition(currentPointIndex);
    updateProgressSlider();
    currentPointIndex++;
    animationId = setTimeout(animateRobot, 100);
}

function updateProgressSlider() {
    const slider = document.getElementById('progress-slider');
    if (slider) {
        const progress = currentPath.length > 0 ? (currentPointIndex / (currentPath.length - 1)) * 100 : 0;
        slider.value = progress;
        updateProgressInfo();
    }
}

function updateProgressInfo() {
    const currentPointEl = document.getElementById('current-point');
    const totalPointsEl = document.getElementById('total-points');
    
    if (currentPointEl) currentPointEl.textContent = `Point: ${currentPointIndex + 1}`;
    if (totalPointsEl) totalPointsEl.textContent = `Total: ${currentPath.length}`;
}

function updateStatistics(trajectory) {
    const totalDistance = calculateTotalDistance(trajectory.points);
    const wallArea = wallDimensions.width * wallDimensions.height;
    const obstacleArea = currentObstacles.reduce((sum, obs) => sum + (obs.width * obs.height), 0);
    const coverageArea = wallArea - obstacleArea;
    const efficiency = coverageArea > 0 ? ((coverageArea / wallArea) * 100).toFixed(1) : 0;

    const elements = {
        'total-distance': `${totalDistance.toFixed(2)} m`,
        'point-count': trajectory.points.length.toString(),
        'coverage-area': `${coverageArea.toFixed(2)} m²`,
        'efficiency': `${efficiency}%`
    };

    Object.entries(elements).forEach(([id, value]) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    });
}

function calculateTotalDistance(points) {
    let total = 0;
    for (let i = 1; i < points.length; i++) {
        const dx = points[i][0] - points[i-1][0];
        const dy = points[i][1] - points[i-1][1];
        total += Math.sqrt(dx * dx + dy * dy);
    }
    return total;
}

function showAlgorithmExplanation(obstacles, stripeWidth) {
    const stripeCount = Math.ceil(wallDimensions.width / stripeWidth);
    const obstacleCount = obstacles.length;
    
    let explanation = `
        <p><strong>Algorithm: Boustrophedon (Ox-Turning Pattern)</strong></p>
        <p>This algorithm creates a systematic back-and-forth pattern that ensures complete coverage:</p>
        <ul>
            <li><strong>Coverage stripes:</strong> ${stripeCount} vertical stripes at ${stripeWidth}m intervals</li>
            <li><strong>Obstacles:</strong> ${obstacleCount} obstacles avoided during path planning</li>
            <li><strong>Pattern:</strong> Alternating left-to-right and right-to-left traversal</li>
        </ul>
        <p><strong>Why Boustrophedon?</strong> This "ox-turning" pattern minimizes direction changes and ensures complete coverage without missing spots or overlapping areas.</p>
    `;

    const explanationEl = document.getElementById('explanation');
    if (explanationEl) {
        explanationEl.innerHTML = explanation;
    }
}

// Trajectory management functions
async function loadSavedTrajectories() {
    try {
        const response = await fetch(`${CONFIG.baseURL}/trajectories`);
        if (!response.ok) {
            throw new Error(`Failed to load trajectories: ${response.status}`);
        }
        
        const trajectories = await response.json();
        const select = document.getElementById('trajectory-select');
        
        if (select) {
            select.innerHTML = '';
            trajectories.forEach(traj => {
                const option = document.createElement('option');
                option.value = traj.id;
                option.textContent = `${traj.name} (${traj.width}×${traj.height}m, ${traj.point_count} points)`;
                select.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error loading trajectories:', error);
    }
}

async function loadSelectedTrajectory() {
    const select = document.getElementById('trajectory-select');
    const trajectoryId = select?.value;
    
    if (!trajectoryId) {
        alert('Please select a trajectory to load.');
        return;
    }

    try {
        const response = await fetch(`${CONFIG.baseURL}/trajectory/${trajectoryId}`);
        if (!response.ok) {
            throw new Error(`Failed to load trajectory: ${response.status}`);
        }
        
        const trajectory = await response.json();

        // Update global variables
        currentPath = trajectory.points;
        currentObstacles = trajectory.obstacles || [];  // Update this line
        wallDimensions = { width: trajectory.width, height: trajectory.height };

        // Update form inputs
        const elements = {
            'width': trajectory.width,
            'height': trajectory.height,
            'obstacles': trajectory.obstacles ? JSON.stringify(trajectory.obstacles) : '[]'  // Update this line
        };

        Object.entries(elements).forEach(([id, value]) => {
            const el = document.getElementById(id);
            if (el) el.value = value;
        });

        // Draw visualization
        drawVisualization();
        updateStatistics(trajectory);

        // Show explanation
        const explanationEl = document.getElementById('explanation');
        if (explanationEl) {
            explanationEl.innerHTML = `
                <p><strong>Previously Saved Trajectory</strong></p>
                <p>This is a previously saved trajectory with ${trajectory.points.length} points covering a ${trajectory.width}×${trajectory.height}m wall.</p>
                <p><strong>Why Boustrophedon?</strong> This "ox-turning" pattern minimizes the number of direction changes and ensures complete coverage without missing spots or painting the same area twice.</p>
            `;
        }

        // Show playback controls and reset
        const controls = document.getElementById('playback-controls');
        if (controls) {
            controls.classList.remove('hidden');
        }
        
        resetPlayback();

    } catch (error) {
        console.error('Error loading trajectory:', error);
        alert('Error loading trajectory: ' + error.message);
    }
}

async function deleteSelectedTrajectory() {
    const select = document.getElementById('trajectory-select');
    const trajectoryId = select?.value;
    
    if (!trajectoryId) {
        alert('Please select a trajectory to delete.');
        return;
    }

    if (!confirm('Are you sure you want to delete this trajectory?')) {
        return;
    }

    try {
        const response = await fetch(`${CONFIG.baseURL}/trajectory/${trajectoryId}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            throw new Error(`Failed to delete trajectory: ${response.status}`);
        }

        // Refresh trajectory list
        loadSavedTrajectories();

        // Clear current visualization if needed
        if (currentPath.length > 0) {
            const canvas = document.getElementById('canvas');
            if (canvas) {
                const ctx = canvas.getContext('2d');
                ctx.clearRect(0, 0, canvas.width, canvas.height);
            }
            
            currentPath = [];
            currentObstacles = [];
            wallDimensions = { width: 0, height: 0 };
            
            const controls = document.getElementById('playback-controls');
            if (controls) {
                controls.classList.add('hidden');
            }

            // Reset statistics
            ['total-distance', 'point-count', 'coverage-area', 'efficiency'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.textContent = '-';
            });

            const explanationEl = document.getElementById('explanation');
            if (explanationEl) {
                explanationEl.innerHTML = '<p>Click "Generate Coverage Path" to see how the Boustrophedon algorithm works!</p>';
            }
        }

        alert('Trajectory deleted successfully!');

    } catch (error) {
        console.error('Error deleting trajectory:', error);
        alert('Error deleting trajectory: ' + error.message);
    }
}
