def is_in_obstacle(x, y, obstacles):
    for obs in obstacles:
        if (
            obs["x"] <= x <= obs["x"] + obs["width"]
            and obs["y"] <= y <= obs["y"] + obs["height"]
        ):
            return True
    return False

def generate_coverage_path(width, height, step=0.5, obstacles=[]):
    path = []
    y = 0.0
    direction = 1  # 1 for left-to-right, -1 for right-to-left

    while y <= height:
        x_range = (
            [round(x, 2) for x in frange(0.0, width, step)]
            if direction == 1
            else [round(x, 2) for x in frange(width, 0.0, -step)]
        )

        for x in x_range:
            if not is_in_obstacle(x, y, obstacles):
                path.append([x, round(y, 2)])
        y += step
        direction *= -1

    return path

def frange(start, stop, step):
    while (step > 0 and start <= stop) or (step < 0 and start >= stop):
        yield start
        start += step
