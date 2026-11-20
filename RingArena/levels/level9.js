registerLevel({
    id: 9,
    name: "Every Mark",
    goal: "targets",
    moves: 3,
    // Rings from the hub outwards; 12 sectors each, clockwise from the top. Letters are figures.
    // A solver checked that 3 moves are the fewest possible.
    start: [
        "....B..C..D.",
        ".C..........",
        ".A..D.....B.",
        ".......A...."
    ],
    target: [
        "A..B..C..D..",
        "............",
        "D..C..B..A..",
        "............"
    ]
});
