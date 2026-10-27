// Puzzle: only 1 of Blue's 5 first moves wins (the hat brim)
registerLevel({
    id: 8,
    name: "The Snowman",
    // Points as [x, y]; points with y = 0 stand on the ground
    nodes: {
        b: [5, 0], m: [5, 2.4], h: [5, 3.8], hat: [5, 4.4],
        al: [3.3, 3.1], ar: [6.7, 3.1],
        gt: [8.5, 0], t1: [8.5, 1.2], t2: [8.5, 2.4]
    },
    // Edges as [from, to, color, shape?]
    edges: [
        ['b', 'm', 'blue', { bend: 1 }], ['b', 'm', 'blue', { bend: -1 }],
        ['m', 'h', 'blue', { bend: 1 }], ['m', 'h', 'red', { bend: -1 }],
        ['m', 'al', 'red', { bend: 0.4 }], ['m', 'ar', 'blue', { bend: -0.4 }],
        ['h', 'hat', 'blue'], ['hat', 'hat', 'red', { size: 0.25, angle: 90 }],
        ['gt', 't1', 'red'], ['t1', 't2', 'red']
    ]
});
