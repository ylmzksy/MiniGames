registerLevel({
    id: 2,
    name: "The Glider Challenge",
    size: 15,
    budget: 2,
    goal: { type: 'occupy', r: 10, c: 10 },
    // Pre-placed living cells as [row, col]
    initial: [
        [4, 4], [5, 5], [5, 6], [6, 4], [6, 5] // A pre-placed pattern
    ]
});
