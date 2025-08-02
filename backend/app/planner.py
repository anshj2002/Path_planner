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
    y_values = [round(y, 2) for y in frange(0.0, height, step)]
    x_values = [round(x, 2) for x in frange(0.0, width, step)]

    for idx, y in enumerate(y_values):
        if idx % 2 == 0:
            row = x_values  # left to right
        else:
            row = reversed(x_values)  # right to left

        for x in row:
            if not is_in_obstacle(x, y, obstacles):
                path.append([x, y])

    return path


def frange(start, stop, step):
    while (step > 0 and start <= stop) or (step < 0 and start >= stop):
        yield start
        start += step
