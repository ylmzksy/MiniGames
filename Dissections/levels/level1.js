registerLevel({
    id: 1,
    name: "The T",
    // set: which piece set from engine.js; solution: where each piece lies in the target, as polygons.
    // The silhouette is the union of these polygons, so every level is exactly solvable.
    set: "tee",
    solution: {
        A: [[0, 2], [2, 2], [1, 3], [0, 3]],
        B: [[3, 2], [5, 2], [5, 3], [4, 3]],
        C: [[2, 2], [3, 2], [4, 3], [1, 3]],
        D: [[2, 0], [3, 0], [3, 2], [2, 2]]
    }
});
