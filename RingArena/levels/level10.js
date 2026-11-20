registerLevel({
    id: 10,
    name: "Grand Arena",
    goal: "groups",
    moves: 3,
    // Rings from the hub outwards; 12 sectors each, clockwise from the top. Letters are figures.
    // A solver checked that 3 moves are the fewest possible.
    start: [
        "...E.E.....E",
        "E..EE.E...E.",
        "E..E..E.E...",
        "E..E..E.E..."
    ]
});
