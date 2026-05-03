registerLevel({
    id: 1,
    name: "The Glider Challenge",
    description: "Reach the target at (10,10) using exactly 2 seeds.",
    size: 15,
    budget: 2,
    goal: { type: 'occupy', r: 10, c: 10 },
    initial: [
        [4, 4], [5, 5], [5, 6], [6, 4], [6, 5] // A pre-placed pattern
    ]
});