registerLevel({
    id: 1,
    name: "Three Pieces",
    // region: '#' cells of the silhouette; pieces: cell lists; solution: where each piece goes (used by Hint).
    region: [".####", ".#.#.", "####.", "...#.", "...#."],
    pieces: [
        { cells: [[0, 0], [0, 1], [0, 2], [0, 3]] },
        { cells: [[0, 1], [1, 0], [1, 1], [1, 2]] },
        { cells: [[0, 0], [1, 0], [2, 0], [3, 0]] }
    ],
    solution: [
        [[0, 1], [0, 2], [0, 3], [0, 4]],
        [[1, 1], [2, 0], [2, 1], [2, 2]],
        [[1, 3], [2, 3], [3, 3], [4, 3]]
    ]
});
