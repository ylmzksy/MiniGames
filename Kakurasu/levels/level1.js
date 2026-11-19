registerLevel({
    id: 1,
    name: "First Shade",
    // rows: clue for each row, top to bottom (sum of the column weights 1..n of its shaded cells).
    // cols: clue for each column, left to right (sum of the row weights 1..n of its shaded cells).
    // Generated and checked by a solver: exactly one solution, found by line-by-line reasoning.
    rows: [8, 6, 6, 6],
    cols: [4, 9, 4, 7]
});
