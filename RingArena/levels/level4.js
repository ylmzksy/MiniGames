registerLevel({
    id: 4,
    name: "Square Up",
    goal: "blocks",
    moves: 2,
    // Rings from the hub outwards; 12 sectors each, clockwise from the top. Letters are figures.
    // A solver checked that 2 moves are the fewest possible.
    start: [
        ".C....CC....",
        "...CC.C..CC.",
        "............",
        "............"
    ]
});
