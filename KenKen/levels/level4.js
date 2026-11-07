registerLevel({
    id: 4,
    name: "Sums",
    size: 4,
    cages: [
        { cells: [[0, 0], [0, 1]], target: 7, op: "+" },
        { cells: [[0, 2], [0, 3]], target: 2, op: "/" },
        { cells: [[1, 0], [1, 1]], target: 2, op: "-" },
        { cells: [[1, 2], [1, 3]], target: 3, op: "/" },
        { cells: [[2, 0], [3, 0]], target: 2, op: "/" },
        { cells: [[2, 1], [2, 2]], target: 1, op: "-" },
        { cells: [[2, 3], [3, 3], [3, 2]], target: 9, op: "+" },
        { cells: [[3, 1]], target: 1, op: "" }
    ]
});
