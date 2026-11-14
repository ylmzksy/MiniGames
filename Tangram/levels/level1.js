registerLevel({
    id: 1,
    name: "Square",
    // Solution: where each piece lies, as a polygon in puzzle units (unit = leg of a small triangle).
    // The silhouette is the union of these polygons, so every level is exactly solvable.
    solution: {
        L1: [[0, 0], [-2, 2], [0, 2]],
        L2: [[-2, 2], [0, 4], [0, 2]],
        M: [[1, 1], [2, 2], [1, 3]],
        SQ: [[0, 1], [1, 1], [1, 2], [0, 2]],
        S1: [[0, 0], [1, 1], [0, 1]],
        S2: [[0, 2], [1, 2], [0, 3]],
        P: [[1, 2], [1, 3], [0, 4], [0, 3]]
    }
});
