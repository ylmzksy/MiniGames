registerLevel({
    id: 1,
    name: "First Steps",
    // regions: one letter per cell; all cells with the same letter form one region (size 1 to 5).
    // givens: the digits shown at the start, '.' = empty cell to fill.
    // Generated with a solver that checked the puzzle has exactly one solution.
    regions: [
        "EEEBB",
        "DDCBB",
        "DCCFA",
        "DCCAA",
        "DGGAA"
    ],
    givens: [
        "213..",
        "4..42",
        ".....",
        ".4.42",
        "....1"
    ]
});
