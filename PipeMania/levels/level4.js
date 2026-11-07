registerLevel({
    id: 4,
    name: "To the Drain",
    width: 8,
    height: 7,
    source: [3, 0],
    sourceDir: "right",
    // drain [row, col, side the ooze must enter from]
    drain: [6, 7, "left"],
    target: 10,
    countdown: 16,
    flowMs: 900,
    seed: 14
});
