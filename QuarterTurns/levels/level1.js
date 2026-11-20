registerLevel({
    id: 1,
    name: "First Turn",
    // start / target: one string per row, tiles separated by spaces: colour letters
    // (r red, g green, b blue, y yellow, p purple, w white) or numbers. Tiles of the same
    // colour are interchangeable. handles (optional): one string per row of inner corners,
    // '+' a handle, '.' none (default: every corner); a tile no handle touches is fixed.
    // par: fewest quarter turns (either direction counts 1), by BFS offline.
    par: 2,
    start: [
        "y y y",
        "b b y",
        "b b y"
    ],
    target: [
        "y y y",
        "y b y",
        "b b b"
    ]
});
