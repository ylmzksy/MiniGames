registerLevel({
    id: 8,
    name: "Crowd",
    goal: "groups",
    moves: 3,
    // Rings from the hub outwards; 12 sectors each, clockwise from the top. Letters are figures.
    // A solver checked that 3 moves are the fewest possible.
    start: [
        "..E..EE....E",
        ".EE....E..E.",
        ".E........E.",
        "E..E........"
    ]
});
