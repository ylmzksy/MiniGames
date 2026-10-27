// Puzzle: the walls form a loop, so one cut wall does not drop the house;
// only 1 of Blue's 5 first moves wins (the green roof edge)
registerLevel({
    id: 4,
    name: "The House",
    // Points as [x, y]; points with y = 0 stand on the ground
    nodes: {
        gl: [3, 0], gr: [7, 0],
        wl: [3, 3], wr: [7, 3], roof: [5, 5],
        an1: [7.8, 4], an2: [8.6, 5],
        gt: [9.5, 0], t1: [9.5, 1.2], t2: [9.5, 2.4]
    },
    // Edges as [from, to, color]
    edges: [
        ['gl', 'wl', 'blue'], ['gr', 'wr', 'red'], ['wl', 'wr', 'blue'],
        ['wl', 'roof', 'green'], ['wr', 'roof', 'blue'],
        ['wr', 'an1', 'red'], ['an1', 'an2', 'red'],
        ['gt', 't1', 'blue'], ['t1', 't2', 'red']
    ]
});
