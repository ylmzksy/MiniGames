registerLevel({
    id: 6,
    name: "Six by Six",
    size: 6,
    cages: [
        { cells: [[0, 0]], target: 1, op: "" },
        { cells: [[0, 1], [1, 1]], target: 4, op: "/" },
        { cells: [[0, 2], [1, 2]], target: 3, op: "-" },
        { cells: [[0, 3], [0, 4], [0, 5]], target: 14, op: "+" },
        { cells: [[1, 0], [2, 0], [3, 0]], target: 90, op: "*" },
        { cells: [[1, 3], [1, 4], [2, 4]], target: 12, op: "+" },
        { cells: [[1, 5], [2, 5]], target: 2, op: "/" },
        { cells: [[2, 1], [3, 1]], target: 10, op: "*" },
        { cells: [[2, 2], [3, 2]], target: 3, op: "/" },
        { cells: [[2, 3], [3, 3]], target: 4, op: "/" },
        { cells: [[3, 4], [3, 5], [4, 5]], target: 14, op: "+" },
        { cells: [[4, 0], [5, 0]], target: 8, op: "*" },
        { cells: [[4, 1], [4, 2]], target: 2, op: "-" },
        { cells: [[4, 3], [5, 3]], target: 2, op: "-" },
        { cells: [[4, 4], [5, 4]], target: 2, op: "/" },
        { cells: [[5, 1], [5, 2]], target: 2, op: "/" },
        { cells: [[5, 5]], target: 1, op: "" }
    ]
});
