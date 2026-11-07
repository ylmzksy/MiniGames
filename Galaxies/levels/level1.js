registerLevel({
    id: 1,
    name: "Five by Five",
    // Galaxy centers as [y, x] in doubled coordinates: a cell (r, c) is [2r+1, 2c+1],
    // an edge between two cells has one even coordinate, a corner has two. Checked: unique solution.
    width: 5,
    height: 5,
    centers: [[7, 7], [3, 1], [8, 1], [9, 5], [2, 6], [9, 9], [8, 3], [2, 3], [5, 4], [7, 5], [4, 9]]
});
