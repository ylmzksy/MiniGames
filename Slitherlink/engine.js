/**
 * Slitherlink. Draw one closed loop along the grid lines between the dots.
 * A clue in a cell says how many of that cell's four sides the loop uses.
 * The loop never crosses or branches. Level map: digits 0-3 or '.' per cell.
 * Edges are keyed "h,r,c" (dot (r,c) to (r,c+1)) and "v,r,c" (dot (r,c) to (r+1,c)).
 */
const SlitherlinkEngine = {
    parse(level) {
        const rows = level.map;
        const height = rows.length;
        const width = rows[0].length;
        const clues = rows.map(row => [...row].map(ch => /[0-3]/.test(ch) ? Number(ch) : null));
        return { width, height, clues };
    },

    cellEdges(r, c) {
        return [`h,${r},${c}`, `h,${r + 1},${c}`, `v,${r},${c}`, `v,${r},${c + 1}`];
    },

    // Edges meeting at dot (r, c) that exist on this grid
    dotEdges(puzzle, r, c) {
        const out = [];
        if (c < puzzle.width) out.push(`h,${r},${c}`);
        if (c > 0) out.push(`h,${r},${c - 1}`);
        if (r < puzzle.height) out.push(`v,${r},${c}`);
        if (r > 0) out.push(`v,${r - 1},${c}`);
        return out;
    },

    // 'ok' when the clue is met, 'bad' when too many lines touch the cell
    clueState(puzzle, lines, r, c) {
        const n = puzzle.clues[r][c];
        const count = this.cellEdges(r, c).filter(k => lines.has(k)).length;
        if (count > n) return 'bad';
        return count === n ? 'ok' : '';
    },

    // Dots with a loose end or a branch
    badDots(puzzle, lines) {
        const bad = new Set();
        for (let r = 0; r <= puzzle.height; r++) {
            for (let c = 0; c <= puzzle.width; c++) {
                const n = this.dotEdges(puzzle, r, c).filter(k => lines.has(k)).length;
                if (n === 1 || n > 2) bad.add(`${r},${c}`);
            }
        }
        return bad;
    },

    endpoints(key) {
        const [t, r, c] = key.split(',');
        const a = `${r},${c}`;
        return t === 'h' ? [a, `${r},${Number(c) + 1}`] : [a, `${Number(r) + 1},${c}`];
    },

    isSingleLoop(lines) {
        if (!lines.size) return false;
        const adj = new Map();
        lines.forEach(key => {
            const [a, b] = this.endpoints(key);
            (adj.get(a) || adj.set(a, []).get(a)).push(b);
            (adj.get(b) || adj.set(b, []).get(b)).push(a);
        });
        for (const list of adj.values()) if (list.length !== 2) return false;
        const start = adj.keys().next().value;
        const seen = new Set([start]);
        const queue = [start];
        while (queue.length) {
            const x = queue.pop();
            adj.get(x).forEach(y => { if (!seen.has(y)) { seen.add(y); queue.push(y); } });
        }
        return seen.size === adj.size;
    },

    isSolved(puzzle, lines) {
        if (!this.isSingleLoop(lines)) return false;
        for (let r = 0; r < puzzle.height; r++) {
            for (let c = 0; c < puzzle.width; c++) {
                if (puzzle.clues[r][c] !== null && this.clueState(puzzle, lines, r, c) !== 'ok') return false;
            }
        }
        return true;
    }
};
