/**
 * Dissection puzzle piece sets, each cut from a simple figure on an integer
 * grid. Levels pick a set and store where each piece lies in the target.
 *   tee       four pieces that form a T (bar 5x1, stem 1x2)
 *   seven     a square cut into seven varied triangles
 *   fourteen  a 12x12 square cut into fourteen pieces in three bands,
 *             in the spirit of Archimedes' Stomachion
 */
const DissectionSets = {
    tee: {
        A: [[0, 2], [2, 2], [1, 3], [0, 3]],
        B: [[3, 2], [5, 2], [5, 3], [4, 3]],
        C: [[2, 2], [3, 2], [4, 3], [1, 3]],
        D: [[2, 0], [3, 0], [3, 2], [2, 2]]
    },
    seven: {
        a: [[0, 0], [4, 0], [2, 1]],
        b: [[2, 1], [4, 0], [4, 2]],
        c: [[0, 0], [4, 2], [2, 2]],
        d: [[4, 2], [4, 4], [2, 4]],
        e: [[2, 2], [4, 2], [2, 4]],
        f: [[0, 0], [2, 2], [0, 4]],
        g: [[0, 4], [2, 2], [2, 4]]
    },
    fourteen: {
        p1: [[0, 0], [4, 0], [0, 4]],
        p2: [[4, 0], [8, 0], [6, 4], [4, 4]],
        p3: [[0, 4], [4, 0], [4, 4]],
        p4: [[8, 0], [12, 0], [12, 4]],
        p5: [[8, 0], [12, 4], [6, 4]],
        p6: [[0, 4], [4, 4], [2, 8], [0, 8]],
        p7: [[4, 4], [6, 4], [6, 8], [2, 8]],
        p8: [[6, 4], [12, 4], [12, 8]],
        p9: [[6, 4], [12, 8], [6, 8]],
        p10: [[0, 8], [2, 8], [0, 12]],
        p11: [[2, 8], [6, 8], [6, 12], [0, 12]],
        p12: [[6, 8], [9, 8], [6, 12]],
        p13: [[9, 8], [12, 8], [12, 12]],
        p14: [[6, 12], [9, 8], [12, 12]]
    }
};
