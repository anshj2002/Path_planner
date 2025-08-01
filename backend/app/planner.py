def generate_coverage_path(width: float, height: float, step: float = 0.5):
    path = []
    y = 0
    direction_left_to_right = True
    while y <= height:
        x_range = range(int(width / step)) if direction_left_to_right else range(int(width / step) - 1, -1, -1)
        for i in x_range:
            x = round(i * step, 2)
            path.append((x, round(y, 2)))
        y = round(y + step, 2)
        direction_left_to_right = not direction_left_to_right
    return path
