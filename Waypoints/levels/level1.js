registerLevel({
    id: 1,
    name: "First Trail",
    // checkpoints: cells [x, y] the trail must pass in this order (first = start, last = end)
    // walls: [x1, y1, x2, y2] the trail can't cross between those two cells. Checked: exactly one solution.
    width: 5,
    height: 5,
    checkpoints: [[2, 0], [3, 3], [3, 2], [2, 4], [1, 2], [3, 1]],
    walls: []
});
