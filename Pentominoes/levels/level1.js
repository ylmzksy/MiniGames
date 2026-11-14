registerLevel({
    id: 1,
    name: "Three Pieces",
    // region: '#' cells to cover; pieces: pentomino letters. The solution is one known tiling (used for tests).
    region: ["#####", "#####", "#####"],
    pieces: ["F", "P", "U"],
    solution: [
        { piece: "P", cells: [[0, 0], [1, 0], [1, 1], [2, 0], [2, 1]] },
        { piece: "F", cells: [[0, 1], [0, 2], [1, 2], [1, 3], [2, 2]] },
        { piece: "U", cells: [[0, 3], [0, 4], [1, 4], [2, 3], [2, 4]] }
    ]
});
