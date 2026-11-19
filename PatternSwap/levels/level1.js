registerLevel({
    id: 1,
    name: "Stripe",
    // goal / start: one string per row, one letter per tile. colors maps each letter to a
    // tile colour (each colour has its own symbol: blue circle, orange triangle, green square,
    // red diamond). Every move swaps two orthogonally adjacent tiles.
    // par: fewest swaps from start to goal, found by bidirectional breadth-first search over
    // all colour arrangements (it also equals the min-cost matching bound for these levels).
    colors: { A: "blue", B: "orange" },
    par: 3,
    goal: [
        "AAA",
        "BBB",
        "AAA"
    ],
    start: [
        "ABA",
        "ABA",
        "AAB"
    ]
});
