registerLevel({
    id: 1,
    name: "First Strike",
    // grid: the numbers, row by row. rows / cols: the target sum of each row (top to bottom)
    // and column (left to right) after crossing out. Generated and checked by a solver:
    // exactly one set of crossed-out cells, found by line-by-line reasoning.
    grid: [
        [2, 6, 6],
        [7, 3, 9],
        [8, 3, 9]
    ],
    rows: [2, 12, 11],
    cols: [10, 6, 9]
});
