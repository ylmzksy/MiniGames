/**
 * Shift Grid rules. The grid is an n x n torus of tiles, stored row by row.
 * A move { line: 'r' | 'c', i, d } shifts row i right (d = 1) or left (d = -1),
 * or column i down (d = 1) or up (d = -1), by one cell; the tile pushed off one
 * edge comes back in on the opposite edge.
 * Tiles are tokens: a colour letter (R G B Y P O) or a number ("1".."36").
 */
const ShiftEngine = {
    COLOURS: ['R', 'G', 'B', 'Y', 'P', 'O'],

    parse(level) {
        const tokens = rows => rows.flatMap(row => row.trim().split(/\s+/));
        const target = tokens(level.target);
        const start = tokens(level.start);
        return {
            n: level.size,
            target,
            grid: start,
            numbered: target.every(t => /^\d+$/.test(t)),
            par: level.par,
            exact: level.exact !== false
        };
    },

    // The cell indexes of a row or column, in order (left to right, top to bottom)
    line(n, line, i) {
        return Array.from({ length: n }, (_, k) => (line === 'r' ? i * n + k : k * n + i));
    },

    // Returns the new grid; also works on any array laid out like the grid (e.g. DOM elements)
    apply(grid, n, move) {
        const out = grid.slice();
        const cells = this.line(n, move.line, move.i);
        cells.forEach((c, k) => { out[cells[(k + move.d + n) % n]] = grid[c]; });
        return out;
    },

    inverse(move) {
        return { line: move.line, i: move.i, d: -move.d };
    },

    isSolved(grid, target) {
        return grid.every((t, i) => t === target[i]);
    }
};
