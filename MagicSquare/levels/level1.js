registerLevel({
    id: 1,
    name: "Lo Shu",
    size: 3,
    // grid: the given numbers row by row, 0 = empty cell to fill. The magic sum is size * (size² + 1) / 2.
    // Generated with a solver that checked the givens allow exactly one magic square.
    grid: [
        [0, 9, 2],
        [0, 0, 0],
        [8, 0, 0]
    ]
});
