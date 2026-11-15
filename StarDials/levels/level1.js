registerLevel({
    id: 1,
    name: "Spin",
    // axes: the three dials' axes, outermost first ('x' across, 'y' up, 'z' towards you); tilted: 3 slanted random axes instead
    // moved: which dials the target is turned on (the others stay at 0°); all three when left out
    // seed fixes stars, slanted axes and target angles; tolerance: how close (degrees) counts as a match
    // targetRods: show the dial rods in the target too; meter: show how far off you are
    axes: ["y", "x", "z"],
    moved: [0],
    seed: 104732,
    stars: 5,
    colored: true,
    lines: false,
    targetRods: true,
    meter: true,
    tolerance: 5
});
