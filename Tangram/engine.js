/**
 * Tangram piece set. The unit is the leg of a small triangle, so the classic
 * 4x4 square has side 2√2 and appears as a diamond. Local polygons:
 *   L1, L2  big triangles (legs 2)     M  medium triangle (hypotenuse 2)
 *   S1, S2  small triangles (legs 1)   SQ unit square   P parallelogram
 * Levels store their solution as world polygons per piece; the shared
 * ShapeFit code derives rotation, flip and position from them.
 */
const TangramPieces = {
    L1: [[0, 0], [2, 0], [0, 2]],
    L2: [[0, 0], [2, 0], [0, 2]],
    M: [[0, 0], [2, 0], [1, 1]],
    SQ: [[0, 0], [1, 0], [1, 1], [0, 1]],
    S1: [[0, 0], [1, 0], [0, 1]],
    S2: [[0, 0], [1, 0], [0, 1]],
    P: [[0, 0], [1, 0], [2, 1], [1, 1]]
};
