registerLevel({
    id: 6,
    name: "On the Marks",
    goal: "targets",
    moves: 2,
    // Rings from the hub outwards; 12 sectors each, clockwise from the top. Letters are figures.
    // A solver checked that 2 moves are the fewest possible.
    start: [
        "A.....B.....",
        "........C...",
        "B.....C.....",
        "A..A........"
    ],
    target: [
        "A.....B.....",
        "..C.....A...",
        "B.....C.....",
        "...........A"
    ]
});
