// Puzzle: mixed stalks; 2 of Blue's 4 first moves win
registerLevel({
    id: 2,
    name: "Mixed Stalks",
    // Points as [x, y]; points with y = 0 stand on the ground
    nodes: {
        g1: [3, 0], a1: [3, 1.2], a2: [3, 2.4], a3: [3, 3.6],
        g2: [6, 0], b1: [6, 1.2], b2: [6, 2.4], b3: [6, 3.6]
    },
    // Edges as [from, to, color]
    edges: [
        ['g1', 'a1', 'blue'], ['a1', 'a2', 'red'], ['a2', 'a3', 'blue'],
        ['g2', 'b1', 'red'], ['b1', 'b2', 'blue'], ['b2', 'b3', 'blue']
    ]
});
