registerLevel({
    id: 1,
    name: "Four Mines",
    // '*' mine, '.' safe. start is the cell revealed at the beginning; checked: solvable without guessing.
    start: [4, 4],
    board: [
        "....*.",
        ".**...",
        "....*.",
        "......",
        "......",
        "......"
    ]
});
