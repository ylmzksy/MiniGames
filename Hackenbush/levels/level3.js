// Puzzle: only 1 of Blue's 5 first moves wins (the blue twig on the red branch)
registerLevel({
    id: 3,
    name: "The Tree",
    // Points as [x, y]; points with y = 0 stand on the ground
    nodes: {
        g: [5, 0], t1: [5, 1.5], t2: [5, 3],
        l: [3.5, 4], l2: [2.5, 5],
        r: [6.5, 4], r2: [7.5, 5],
        m: [5, 4.5],
        gs: [9, 0], s1: [9, 1.2], s2: [9, 2.4]
    },
    // Edges as [from, to, color, shape?]
    edges: [
        ['g', 't1', 'blue'], ['t1', 't2', 'red'],
        ['t2', 'l', 'blue', { bend: -0.3 }], ['l', 'l2', 'blue', { bend: 0.3 }],
        ['t2', 'r', 'red', { bend: 0.3 }], ['r', 'r2', 'blue', { bend: -0.3 }],
        ['t2', 'm', 'red'],
        ['gs', 's1', 'red'], ['s1', 's2', 'blue']
    ]
});
