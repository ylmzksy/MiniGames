registerLevel({
    id: 1,
    name: "Hexagon",
    // The target shape is the union of these placements: [piece, x, y, rotation steps of 60°]
    solution: [
        ["trapezoid", -1, 0, 0],
        ["trapezoid", 1, 0, 3]
    ]
});
