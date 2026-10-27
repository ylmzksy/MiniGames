// Puzzle: 2 of Blue's 6 first moves win (the blue rays)
registerLevel({
    id: 7,
    name: "The Sun",
    // Points as [x, y]; points with y = 0 stand on the ground
    nodes: {
        g: [5, 0], p: [5, 1.2],
        b: [5, 2.2], r: [6, 3.2], t: [5, 4.2], l: [4, 3.2],
        rr: [7, 3.2], rt: [5, 5.2], rl: [3, 3.2],
        gg: [8.5, 0], k1: [8.8, 0.9]
    },
    // Edges as [from, to, color, shape?]; bend -0.4142 makes each quarter of the ring circular
    edges: [
        ['g', 'p', 'blue'], ['p', 'b', 'blue'],
        ['b', 'r', 'red', { bend: -0.4142 }], ['r', 't', 'blue', { bend: -0.4142 }],
        ['t', 'l', 'red', { bend: -0.4142 }], ['l', 'b', 'blue', { bend: -0.4142 }],
        ['r', 'rr', 'blue'], ['t', 'rt', 'blue'], ['l', 'rl', 'red'],
        ['gg', 'k1', 'red', { bend: 0.6 }], ['k1', 'k1', 'red', { size: 0.35, angle: 70 }]
    ]
});
