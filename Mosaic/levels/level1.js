registerLevel({
    id: 1,
    name: "Little Tiles",
    // Solved grid: '#' black, '.' white. Clue numbers are computed from it.
    solution: [
        "#..#",
        "..#.",
        "..##",
        "#..#"
    ],
    // 'x' marks the cells that show a clue. Checked: unique solution, solvable by deduction alone.
    clues: [
        "xxx.",
        "x..x",
        "xxxx",
        "xxx."
    ]
});
