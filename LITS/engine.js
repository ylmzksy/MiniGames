/**
 * LITS. The grid is split into regions. Shade exactly one tetromino (four
 * connected cells shaped like an L, I, T or S, in any rotation or mirror
 * image) in every region so that all shaded cells form one connected area,
 * no 2x2 block is fully shaded, and two tetrominoes of the same shape never
 * touch across a region border.
 * Level: `regions` rows of letters. Player marks: 'shaded', 'dot' or null.
 */
const LitsEngine = {
    directions: [[-1, 0], [1, 0], [0, -1], [0, 1]],

    parse(level) {
        const regions = level.regions.map(row => [...row]);
        const ids = [...new Set(regions.flat())].sort();
        return { size: regions.length, width: regions[0].length, height: regions.length, regions, ids };
    },

    // Canonical form of a cell set: translated to the origin and sorted
    normalize(cells) {
        const mr = Math.min(...cells.map(([r]) => r));
        const mc = Math.min(...cells.map(([, c]) => c));
        return cells.map(([r, c]) => [r - mr, c - mc]).sort((a, b) => a[0] - b[0] || a[1] - b[1]).map(p => p.join(',')).join('|');
    },

    shapeTable() {
        if (this.table) return this.table;
        const base = { L: [[0, 0], [1, 0], [2, 0], [2, 1]], I: [[0, 0], [1, 0], [2, 0], [3, 0]], T: [[0, 0], [0, 1], [0, 2], [1, 1]], S: [[0, 0], [0, 1], [1, 1], [1, 2]], O: [[0, 0], [0, 1], [1, 0], [1, 1]] };
        this.table = {};
        Object.entries(base).forEach(([name, cells]) => {
            let cur = cells;
            for (let flip = 0; flip < 2; flip++) {
                for (let rot = 0; rot < 4; rot++) {
                    this.table[this.normalize(cur)] = name;
                    cur = cur.map(([r, c]) => [c, -r]);
                }
                cur = cur.map(([r, c]) => [r, -c]);
            }
        });
        return this.table;
    },

    // 'L', 'I', 'T', 'S', 'O' or null for a set of four cells
    shape(cells) {
        return cells.length === 4 ? this.shapeTable()[this.normalize(cells)] ?? null : null;
    },

    // Connected groups of shaded cells inside one region
    groups(puzzle, marks, test) {
        const seen = new Set();
        const out = [];
        for (let r = 0; r < puzzle.height; r++) {
            for (let c = 0; c < puzzle.width; c++) {
                const key = `${r},${c}`;
                if (seen.has(key) || !test(r, c)) continue;
                const cells = [];
                const queue = [[r, c]];
                seen.add(key);
                while (queue.length) {
                    const [cr, cc] = queue.pop();
                    cells.push([cr, cc]);
                    this.directions.forEach(([dr, dc]) => {
                        const nr = cr + dr;
                        const nc = cc + dc;
                        const k = `${nr},${nc}`;
                        if (nr >= 0 && nc >= 0 && nr < puzzle.height && nc < puzzle.width && !seen.has(k) && test(nr, nc)) { seen.add(k); queue.push([nr, nc]); }
                    });
                }
                out.push(cells);
            }
        }
        return out;
    },

    shadedCount(puzzle, marks, id) {
        let n = 0;
        marks.forEach((row, r) => row.forEach((m, c) => { if (m === 'shaded' && puzzle.regions[r][c] === id) n++; }));
        return n;
    },

    // Cells of fully shaded 2x2 blocks
    blocks(puzzle, marks) {
        const bad = new Set();
        for (let r = 0; r + 1 < puzzle.height; r++) {
            for (let c = 0; c + 1 < puzzle.width; c++) {
                const quad = [[r, c], [r + 1, c], [r, c + 1], [r + 1, c + 1]];
                if (quad.every(([a, b]) => marks[a][b] === 'shaded')) quad.forEach(([a, b]) => bad.add(`${a},${b}`));
            }
        }
        return bad;
    },

    // The tetromino each region holds, when its shaded cells form exactly one valid piece
    pieces(puzzle, marks) {
        const result = {};
        puzzle.ids.forEach(id => {
            const groups = this.groups(puzzle, marks, (r, c) => marks[r][c] === 'shaded' && puzzle.regions[r][c] === id);
            const shape = groups.length === 1 ? this.shape(groups[0]) : null;
            result[id] = shape && shape !== 'O' ? { cells: groups[0], shape } : null;
        });
        return result;
    },

    // Cells of same-shaped pieces that touch across a region border
    clashes(puzzle, marks, pieces = this.pieces(puzzle, marks)) {
        const bad = new Set();
        const shapeAt = {};
        Object.entries(pieces).forEach(([id, piece]) => { if (piece) piece.cells.forEach(([r, c]) => { shapeAt[`${r},${c}`] = [id, piece.shape]; }); });
        const badIds = new Set();
        Object.entries(shapeAt).forEach(([key, [id, shape]]) => {
            const [r, c] = key.split(',').map(Number);
            this.directions.forEach(([dr, dc]) => {
                const other = shapeAt[`${r + dr},${c + dc}`];
                if (other && other[0] !== id && other[1] === shape) { badIds.add(id); badIds.add(other[0]); }
            });
        });
        // both pieces of a clash are marked whole
        badIds.forEach(id => pieces[id].cells.forEach(([r, c]) => bad.add(`${r},${c}`)));
        return bad;
    },

    isConnected(puzzle, marks) {
        const groups = this.groups(puzzle, marks, (r, c) => marks[r][c] === 'shaded');
        return groups.length === 1;
    },

    isSolved(puzzle, marks) {
        const pieces = this.pieces(puzzle, marks);
        if (!puzzle.ids.every(id => pieces[id] && this.shadedCount(puzzle, marks, id) === 4)) return false;
        return this.blocks(puzzle, marks).size === 0 && this.clashes(puzzle, marks, pieces).size === 0 && this.isConnected(puzzle, marks);
    }
};
