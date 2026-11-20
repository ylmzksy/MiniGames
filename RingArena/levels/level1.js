registerLevel({
    id: 1,
    name: "First Turn",
    goal: "lines",
    moves: 1,
    // Rings from the hub outwards; 12 sectors each, clockwise from the top. Letters are figures.
    // A solver checked that 1 move is the fewest possible.
    start: [
        ".........A..",
        "A...........",
        "A...........",
        "A..........."
    ]
});
