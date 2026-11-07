registerLevel({
    id: 5,
    name: "Five by Five",
    size: 5,
    cages: [
        { cells: [[0, 0], [1, 0]], target: 8, op: "+" },
        { cells: [[0, 1], [1, 1]], target: 3, op: "-" },
        { cells: [[0, 2], [1, 2]], target: 4, op: "+" },
        { cells: [[0, 3], [0, 4]], target: 7, op: "+" },
        { cells: [[1, 3], [2, 3]], target: 2, op: "/" },
        { cells: [[1, 4], [2, 4]], target: 3, op: "-" },
        { cells: [[2, 0], [3, 0], [3, 1]], target: 5, op: "+" },
        { cells: [[2, 1], [2, 2], [3, 2]], target: 12, op: "+" },
        { cells: [[3, 3], [4, 3]], target: 2, op: "-" },
        { cells: [[3, 4], [4, 4]], target: 2, op: "-" },
        { cells: [[4, 0], [4, 1]], target: 20, op: "*" },
        { cells: [[4, 2]], target: 2, op: "" }
    ]
});
