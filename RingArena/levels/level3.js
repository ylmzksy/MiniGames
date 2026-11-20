registerLevel({
    id: 3,
    name: "Two Rows",
    goal: "lines",
    moves: 2,
    // Rings from the hub outwards; 12 sectors each, clockwise from the top. Letters are figures.
    // A solver checked that 2 moves are the fewest possible.
    start: [
        "A..A..A.....",
        "............",
        "A.....A.....",
        "A..A..A....."
    ]
});
