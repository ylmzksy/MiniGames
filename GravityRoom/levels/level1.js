registerLevel({
    id: 1,
    name: "First Turn",
    // map: '#' wall, '.' empty, r g b y coloured blocks, 'o' grey stone (no target).
    // goal: where each colour must end up. par = fewest turns, found by BFS.
    par: 2,
    map: [
        "....",
        "....",
        "....",
        "r..."
    ],
    goal: [
        "...r",
        "....",
        "....",
        "...."
    ]
});
