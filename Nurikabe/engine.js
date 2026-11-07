/**
 * Nurikabe. Numbers mark islands. Shade cells to form the sea so that:
 *   1. every island is a connected white area holding exactly one number,
 *      and has exactly that many cells
 *   2. all sea cells form one connected area
 *   3. the sea never fills a 2x2 block
 * Level map: digits for island sizes, '.' for unknown cells.
 * Player marks: 'sea', 'white' (a note meaning "surely land") or null.
 * Unmarked cells count as land when the solution is checked.
 */
const NurikabeEngine = {
    directions: [[-1, 0], [1, 0], [0, -1], [0, 1]],

    parse(level) {
        const numbers = level.map.map(row => [...row].map(ch => /[1-9]/.test(ch) ? Number(ch) : null));
        return { width: numbers[0].length, height: numbers.length, numbers };
    },

    neighbors(puzzle, r, c) {
        return this.directions.map(([dr, dc]) => [r + dr, c + dc])
            .filter(([nr, nc]) => nr >= 0 && nc >= 0 && nr < puzzle.height && nc < puzzle.width);
    },

    // Connected groups of cells for which `test(r, c)` holds
    groups(puzzle, test) {
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
                    this.neighbors(puzzle, cr, cc).forEach(([nr, nc]) => {
                        const k = `${nr},${nc}`;
                        if (!seen.has(k) && test(nr, nc)) { seen.add(k); queue.push([nr, nc]); }
                    });
                }
                out.push(cells);
            }
        }
        return out;
    },

    // Cells of 2x2 sea blocks
    seaBlocks(puzzle, marks) {
        const bad = new Set();
        for (let r = 0; r + 1 < puzzle.height; r++) {
            for (let c = 0; c + 1 < puzzle.width; c++) {
                if ([[r, c], [r + 1, c], [r, c + 1], [r + 1, c + 1]].every(([a, b]) => marks[a][b] === 'sea')) {
                    [[r, c], [r + 1, c], [r, c + 1], [r + 1, c + 1]].forEach(([a, b]) => bad.add(`${a},${b}`));
                }
            }
        }
        return bad;
    },

    // Live errors: groups of decided land (numbers + white marks) with two numbers or too many cells
    islandErrors(puzzle, marks) {
        const bad = new Set();
        const land = (r, c) => puzzle.numbers[r][c] !== null || marks[r][c] === 'white';
        this.groups(puzzle, land).forEach(cells => {
            const numbers = cells.filter(([r, c]) => puzzle.numbers[r][c] !== null);
            if (numbers.length > 1 || (numbers.length === 1 && cells.length > puzzle.numbers[numbers[0][0]][numbers[0][1]])) {
                cells.forEach(([r, c]) => bad.add(`${r},${c}`));
            }
        });
        return bad;
    },

    isSolved(puzzle, marks) {
        if (this.seaBlocks(puzzle, marks).size) return false;
        const land = (r, c) => marks[r][c] !== 'sea';
        for (const cells of this.groups(puzzle, land)) {
            const numbers = cells.filter(([r, c]) => puzzle.numbers[r][c] !== null);
            if (numbers.length !== 1 || cells.length !== puzzle.numbers[numbers[0][0]][numbers[0][1]]) return false;
        }
        const seas = this.groups(puzzle, (r, c) => marks[r][c] === 'sea');
        return seas.length === 1;
    }
};
