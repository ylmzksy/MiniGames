registerLevel({
    id: 1,
    name: "The Eternal Flame",
    size: 20,
    budget: 5,
    goal: { type: 'survive', generations: 50 },
    // Pre-placed living cells as [row, col]
    initial: [
        [10, 10], [10, 11]
    ]
});
