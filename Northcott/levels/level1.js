registerLevel({
    id: 1,
    name: "Three Rows",
    // rows as [blue column, red column]; the gaps' XOR is non-zero so the first player (you) can win
    width: 8,
    rows: [[0, 3], [1, 5], [0, 7]]
});
