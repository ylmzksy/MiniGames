registerLevel({
    id: 1,
    name: "First Balance",
    // grid: 'A' circle, 'B' square, '.' empty. signs: [x, y, side, kind]: between cell (x, y) and the cell
    // to its right or below, '=' same symbol, 'x' different. Checked: solvable by deduction, one solution.
    grid: [
        ".B..",
        "..B.",
        "...A",
        "...."
    ],
    signs: [
        [1, 1, "right", "="]
    ]
});
