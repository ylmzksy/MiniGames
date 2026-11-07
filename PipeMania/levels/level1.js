registerLevel({
    id: 1,
    name: "Slow Start",
    // source [row, col] with the direction the ooze leaves it; target pipes to fill; countdown in seconds; flowMs per pipe; seed shapes the piece queue
    width: 7,
    height: 6,
    source: [3, 0],
    sourceDir: "right",
    target: 6,
    countdown: 20,
    flowMs: 1400,
    seed: 11
});
