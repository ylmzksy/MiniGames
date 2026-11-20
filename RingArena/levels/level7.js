registerLevel({
    id: 7,
    name: "Sorted Rows",
    goal: "same",
    moves: 3,
    // Rings from the hub outwards; 12 sectors each, clockwise from the top. Letters are figures.
    // A solver checked that 3 moves are the fewest possible.
    start: [
        "......A.....",
        "A..B..B..A..",
        "............",
        "...B..B..A.."
    ]
});
