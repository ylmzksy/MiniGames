registerLevel({
    id: 6,
    name: "The Hill",
    par: 2,
    tee: [200, 460],
    hole: [200, 110],
    walls: [
        [[60, 50], [340, 50], [340, 510], [60, 510]]
    ],
    // slopes push the ball by (ax, ay) px/s² while it rolls over them
    slopes: [{ x: 60, y: 200, w: 280, h: 160, ax: 220, ay: 0 }],
    sand: [{ x: 280, y: 200, w: 60, h: 160 }]
});
