/**
 * Futoshiki: fill an n x n grid so every row and column holds 1..n once, and
 * every inequality sign between two neighboring cells is true.
 * Level format: `grid` rows of length 2n-1 alternating cells and signs.
 *   Cell rows:  digit or '.' at even positions; '<', '>' or '.' between cells
 *   Sign rows:  'v' (cell above is greater), '^' (cell above is smaller) or '.'
 *               at even positions, between two cell rows
 */
const FutoshikiEngine = {
    parse(level) {
        const size = (level.grid[0].length + 1) / 2;
        const givens = [];
        const across = []; // across[r][c]: sign between (r,c) and (r,c+1)
        const down = [];   // down[r][c]: sign between (r,c) and (r+1,c), as '<' or '>' for the upper cell
        for (let r = 0; r < size; r++) {
            const row = level.grid[2 * r];
            givens.push([]);
            across.push([]);
            for (let c = 0; c < size; c++) {
                const ch = row[2 * c];
                givens[r][c] = ch === '.' ? 0 : Number(ch);
                if (c < size - 1) across[r][c] = row[2 * c + 1] === '.' ? null : row[2 * c + 1];
            }
            if (r < size - 1) {
                const signs = level.grid[2 * r + 1];
                down.push([]);
                for (let c = 0; c < size; c++) {
                    const ch = signs[2 * c];
                    down[r][c] = ch === 'v' ? '>' : ch === '^' ? '<' : null;
                }
            }
        }
        return { size, givens, across, down };
    },

    // All inequality constraints as { a: [r, c], b: [r, c], sign } meaning a sign b
    constraints(puzzle) {
        const out = [];
        puzzle.across.forEach((row, r) => row.forEach((sign, c) => {
            if (sign) out.push({ a: [r, c], b: [r, c + 1], sign });
        }));
        puzzle.down.forEach((row, r) => row.forEach((sign, c) => {
            if (sign) out.push({ a: [r, c], b: [r + 1, c], sign });
        }));
        return out;
    },

    holds(sign, x, y) {
        return sign === '<' ? x < y : x > y;
    },

    // Keys "r,c" of cells that repeat a digit in their row or column, and the
    // constraints whose two cells are filled but disagree with the sign
    conflicts(puzzle, values) {
        const cells = new Set();
        const n = puzzle.size;
        for (let i = 0; i < n; i++) {
            const rowSeen = {};
            const colSeen = {};
            for (let j = 0; j < n; j++) {
                const rv = values[i][j];
                const cv = values[j][i];
                if (rv) (rowSeen[rv] ||= []).push(`${i},${j}`);
                if (cv) (colSeen[cv] ||= []).push(`${j},${i}`);
            }
            [rowSeen, colSeen].forEach(seen => Object.values(seen).forEach(list => {
                if (list.length > 1) list.forEach(key => cells.add(key));
            }));
        }
        const signs = this.constraints(puzzle).filter(({ a, b, sign }) => {
            const x = values[a[0]][a[1]];
            const y = values[b[0]][b[1]];
            return x && y && !this.holds(sign, x, y);
        });
        return { cells, signs };
    },

    isSolved(puzzle, values) {
        if (values.some(row => row.some(v => !v))) return false;
        const { cells, signs } = this.conflicts(puzzle, values);
        return cells.size === 0 && signs.length === 0;
    }
};
