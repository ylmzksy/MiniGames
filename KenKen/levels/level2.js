registerLevel({
    id: 2,
    name: "Pairs",
    size: 4,
    cages: [
        { cells: [[0, 0], [0, 1]], target: 2, op: "/" },
        { cells: [[0, 2], [1, 2]], target: 3, op: "-" },
        { cells: [[0, 3], [1, 3]], target: 6, op: "*" },
        { cells: [[1, 0], [1, 1]], target: 3, op: "/" },
        { cells: [[2, 0], [3, 0]], target: 1, op: "-" },
        { cells: [[2, 1], [3, 1]], target: 2, op: "/" },
        { cells: [[2, 2], [2, 3]], target: 2, op: "-" },
        { cells: [[3, 2], [3, 3]], target: 2, op: "/" }
    ]
});
