registerLevel({
    id: 1,
    name: "First Slide",
    // size: the frame is size x size. start: the tiles row by row, 0 is the gap.
    // target (optional): the arrangement to reach; default 1, 2, 3 ... with the gap last.
    // picture (optional): id of a drawn image cut into the tiles (see pictures.js).
    // par: fewest single-tile moves, found offline by BFS / IDA* (Manhattan + linear conflict).
    size: 3,
    par: 6,
    start: [
        [4, 1, 3],
        [7, 2, 5],
        [0, 8, 6]
    ]
});
