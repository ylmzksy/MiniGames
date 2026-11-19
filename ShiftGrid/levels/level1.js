registerLevel({
    id: 1,
    name: "Three Stripes",
    // size: n for an n x n grid. target / start: one string per row, tokens separated by spaces:
    // a colour letter (R G B Y P O) or a tile number. The start is the target scrambled by random
    // row/column shifts. par: fewest moves, found by an exhaustive (bidirectional) search;
    // exact: false means par is only the scramble length, an upper bound.
    size: 3,
    par: 2,
    exact: true,
    target: [
        "R R R",
        "G G G",
        "B B B"
    ],
    start: [
        "G R G",
        "B G B",
        "R B R"
    ]
});
