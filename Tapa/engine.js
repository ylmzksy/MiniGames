/**
 * Tapa. Shade cells to build one connected wall so that:
 *   1. every clue is right: the numbers in a clue cell are the lengths of the
 *      separate runs of shaded cells among its eight neighbors, read around
 *      the ring (0 = no shaded neighbor, 8 = all of them)
 *   2. clue cells are never shaded
 *   3. the wall never fills a 2x2 block
 *   4. all shaded cells are orthogonally connected
 * Level map: rows of space-separated cells, '.' unknown, clues as numbers joined by '/'.
 * Player marks: 'wall', 'dot' (a note meaning "surely empty") or null.
 */
const TapaEngine = {
    ring: [[-1, -1], [-1, 0], [-1, 1], [0, 1], [1, 1], [1, 0], [1, -1], [0, -1]],
    directions: [[-1, 0], [1, 0], [0, -1], [0, 1]],

    parse(level) {
        const clues = level.map.map(row => row.trim().split(/\s+/).map(tok =>
            tok === '.' ? null : tok.split('/').map(Number).sort((a, b) => a - b)));
        return { width: clues[0].length, height: clues.length, clues };
    },

    // Run lengths of an 8-bit ring mask, sorted
    runsOf(mask) {
        const bits = Array.from({ length: 8 }, (_, i) => (mask >> i) & 1);
        if (bits.every(Boolean)) return [8];
        if (!bits.some(Boolean)) return [0];
        const start = bits.indexOf(0);
        const runs = [];
        let run = 0;
        for (let k = 1; k <= 8; k++) {
            if (bits[(start + k) % 8]) run++;
            else if (run) { runs.push(run); run = 0; }
        }
        return runs.sort((a, b) => a - b);
    },

    // All ring masks that match a clue (cached per clue text)
    masksFor(clue) {
        const key = clue.join('/');
        this.cache = this.cache || {};
        if (!this.cache[key]) {
            this.cache[key] = [];
            for (let m = 0; m < 256; m++) if (this.runsOf(m).join('/') === key) this.cache[key].push(m);
        }
        return this.cache[key];
    },

    ringCells(puzzle, r, c) {
        return this.ring.map(([dr, dc]) => {
            const nr = r + dr;
            const nc = c + dc;
            return nr >= 0 && nc >= 0 && nr < puzzle.height && nc < puzzle.width ? [nr, nc] : null;
        });
    },

    // 'ok' when the ring is fully decided and matches, 'bad' when no completion can match
    clueState(puzzle, marks, r, c, strict = false) {
        let known1 = 0;
        let known0 = 0;
        this.ringCells(puzzle, r, c).forEach((cell, i) => {
            const v = cell === null ? 'dot' : marks[cell[0]][cell[1]] ?? (strict ? 'dot' : null);
            if (v === 'wall') known1 |= 1 << i;
            else if (v === 'dot' || (cell && puzzle.clues[cell[0]][cell[1]])) known0 |= 1 << i;
        });
        const masks = this.masksFor(puzzle.clues[r][c]);
        const possible = masks.some(m => (m & known1) === known1 && (m & known0) === 0);
        if (!possible) return 'bad';
        return (known1 | known0) === 255 ? 'ok' : '';
    },

    // Cells of fully shaded 2x2 blocks
    blocks(puzzle, marks) {
        const bad = new Set();
        for (let r = 0; r + 1 < puzzle.height; r++) {
            for (let c = 0; c + 1 < puzzle.width; c++) {
                const quad = [[r, c], [r + 1, c], [r, c + 1], [r + 1, c + 1]];
                if (quad.every(([a, b]) => marks[a][b] === 'wall')) quad.forEach(([a, b]) => bad.add(`${a},${b}`));
            }
        }
        return bad;
    },

    wallCount(marks) {
        return marks.flat().filter(m => m === 'wall').length;
    },

    isWallConnected(puzzle, marks) {
        let start = null;
        let total = 0;
        marks.forEach((row, r) => row.forEach((m, c) => { if (m === 'wall') { total++; if (!start) start = [r, c]; } }));
        if (!start) return true;
        const seen = new Set([`${start[0]},${start[1]}`]);
        const queue = [start];
        while (queue.length) {
            const [r, c] = queue.pop();
            this.directions.forEach(([dr, dc]) => {
                const nr = r + dr;
                const nc = c + dc;
                const key = `${nr},${nc}`;
                if (marks[nr]?.[nc] === 'wall' && !seen.has(key)) { seen.add(key); queue.push([nr, nc]); }
            });
        }
        return seen.size === total;
    },

    isSolved(puzzle, marks) {
        if (this.wallCount(marks) === 0 || this.blocks(puzzle, marks).size || !this.isWallConnected(puzzle, marks)) return false;
        for (let r = 0; r < puzzle.height; r++) {
            for (let c = 0; c < puzzle.width; c++) {
                if (puzzle.clues[r][c] && this.clueState(puzzle, marks, r, c, true) !== 'ok') return false;
            }
        }
        return true;
    }
};
