registerLevel({
    id: 1,
    name: "Three by Three",
    // Cages: cells as [row, col], a target and an operation (+ - * /, or "" for a single cell).
    // Checked: unique solution, solvable by candidate elimination alone.
    size: 3,
    cages: [
        { cells: [[0, 0], [0, 1]], target: 3, op: "+" },
        { cells: [[0, 2], [1, 2]], target: 2, op: "-" },
        { cells: [[1, 0], [2, 0]], target: 3, op: "/" },
        { cells: [[1, 1], [2, 1]], target: 1, op: "-" },
        { cells: [[2, 2]], target: 2, op: "" }
    ]
});
