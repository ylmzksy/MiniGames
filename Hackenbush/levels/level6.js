// Puzzle: only 1 of Blue's 4 first moves wins
// (cut your own string in the middle to drop the red balloon)
registerLevel({
    id: 6,
    name: "The Balloons",
    // Points as [x, y]; points with y = 0 stand on the ground
    nodes: {
        g: [4, 0], s1: [4.2, 1.2], s2: [3.8, 2.3], k: [4, 3.2], top: [4, 5.2],
        g2: [7, 0], b1: [7.3, 2.4],
        g3: [9.3, 0], c1: [9, 1.6]
    },
    // Edges as [from, to, color, shape?]
    edges: [
        ['g', 's1', 'blue', { bend: 0.4 }], ['s1', 's2', 'blue', { bend: -0.4 }],
        ['s2', 'k', 'red', { bend: 0.4 }],
        ['k', 'top', 'red', { bend: 1 }], ['k', 'top', 'red', { bend: -1 }],
        ['g2', 'b1', 'red', { bend: -0.3 }], ['b1', 'b1', 'blue', { size: 0.6, angle: 80 }],
        ['g3', 'c1', 'red', { bend: 0.3 }], ['c1', 'c1', 'blue', { size: 0.45, angle: 100 }]
    ]
});
