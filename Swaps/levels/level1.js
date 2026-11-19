registerLevel({
    id: 1,
    name: "First Swaps",
    // A cols x rows grid; cells are listed in reading order (left to right, top to bottom).
    // Tiles are numbered 1..n. goal: the tile that belongs in each cell (shown as the target);
    // start: the tile in each cell at the beginning.
    // rule: which two tiles may swap: "any", "line" (same row or column), "near" (orthogonal
    // neighbours) or "knight" (a chess knight's move apart).
    // face: how tiles look: "number", "suit" (tile t = shape (t-1)/4, value (t-1)%4+1)
    // or "picture" (picture names the image; each tile shows the piece of its goal cell).
    // par: fewest swaps. For "any" it is tiles minus cycles of the permutation; for the other
    // rules it was found by (bidirectional) breadth-first search over all arrangements.
    cols: 3,
    rows: 3,
    rule: "any",
    face: "number",
    par: 3,
    goal: [
         1,  2,  3,
         4,  5,  6,
         7,  8,  9
    ],
    start: [
         5,  3,  2,
         4,  1,  8,
         7,  6,  9
    ]
});
