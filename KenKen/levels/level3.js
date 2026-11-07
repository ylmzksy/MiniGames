registerLevel({
    id: 3,
    name: "Mixed Cages",
    size: 4,
    cages: [
        { cells: [[0, 0], [1, 0]], target: 2, op: "-" },
        { cells: [[0, 1], [1, 1]], target: 4, op: "*" },
        { cells: [[0, 2]], target: 2, op: "" },
        { cells: [[0, 3], [1, 3]], target: 2, op: "/" },
        { cells: [[1, 2], [2, 2]], target: 3, op: "*" },
        { cells: [[2, 0], [3, 0]], target: 2, op: "/" },
        { cells: [[2, 1], [3, 1]], target: 1, op: "-" },
        { cells: [[2, 3], [3, 3], [3, 2]], target: 8, op: "+" }
    ]
});
