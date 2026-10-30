registerLevel({
    id: 1,
    name: "Four Givens",
    // Rows alternate cells and signs. Cell rows: digit or '.', with '<', '>' or '.' between cells.
    // Sign rows: 'v' means the cell above is greater, '^' smaller, '.' no sign.
    // Each level is checked to have a unique solution reachable by deduction alone.
    grid: [
        "..1....",
        "v.....^",
        "1......",
        ".......",
        "3>.....",
        ".......",
        "......3"
    ]
});
