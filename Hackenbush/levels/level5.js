// Puzzle: green stems can be cut by both players;
// only 1 of Blue's 7 first moves wins (the bottom of the flower stem)
registerLevel({
    id: 5,
    name: "The Flower",
    // Points as [x, y]; points with y = 0 stand on the ground
    nodes: {
        g: [5, 0], s1: [5, 1.5], s2: [5, 3], c: [5, 4],
        lf: [3.7, 2.5], rf: [6.3, 2.5],
        gg: [1.5, 0], k1: [1.8, 1.3],
        gq: [8.5, 0], q1: [8.3, 1.2], q2: [8.6, 2.3]
    },
    // Edges as [from, to, color, shape?]
    edges: [
        ['g', 's1', 'green'], ['s1', 's2', 'green'], ['s2', 'c', 'blue'],
        ['c', 'c', 'red', { size: 0.45, angle: 165 }],
        ['c', 'c', 'red', { size: 0.45, angle: 15 }],
        ['c', 'c', 'blue', { size: 0.45, angle: 90 }],
        ['s1', 'lf', 'red', { bend: -0.7 }], ['s1', 'rf', 'red', { bend: 0.7 }],
        ['gg', 'k1', 'green', { bend: 0.6 }],
        ['gq', 'q1', 'green', { bend: -0.4 }], ['q1', 'q2', 'blue', { bend: 0.4 }]
    ]
});
