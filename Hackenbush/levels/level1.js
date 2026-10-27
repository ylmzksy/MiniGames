// Puzzle: cut your top edge first; cutting the bottom drops both blue edges
registerLevel({
    id: 1,
    name: "Two Stalks",
    // Points as [x, y]; points with y = 0 stand on the ground
    nodes: {
        g1: [3, 0], a: [3, 1.2], b: [3, 2.4],
        g2: [6, 0], c: [6, 1.2]
    },
    // Edges as [from, to, color]
    edges: [
        ['g1', 'a', 'blue'], ['a', 'b', 'blue'],
        ['g2', 'c', 'red']
    ]
});
