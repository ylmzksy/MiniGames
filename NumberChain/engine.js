/**
 * Number Chain rules. Every board cell gets a number from 1 to N (N = number
 * of cells) so that 1, 2, …, N form one chain: each number sits next to the
 * following one. "Next to" means up/down/left/right, or also diagonal when the
 * level has diagonal: true. Holes ("#") are not part of the board.
 * Values are kept in a flat array over all width × height positions: 0 = empty,
 * null = hole.
 */
const ChainEngine = {
    parse(level) {
        const rows = level.grid.map(row => row.trim().split(/\s+/));
        const height = rows.length;
        const width = rows[0].length;
        const givens = [];
        const holes = [];
        rows.forEach(row => row.forEach(tok => {
            holes.push(tok === '#');
            givens.push(/^\d+$/.test(tok) ? Number(tok) : 0);
        }));
        const diagonal = !!level.diagonal;
        const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        if (diagonal) dirs.push([1, 1], [1, -1], [-1, 1], [-1, -1]);
        const neighbours = givens.map((_, i) => {
            if (holes[i]) return [];
            const x = i % width;
            const y = Math.floor(i / width);
            return dirs
                .map(([dx, dy]) => [x + dx, y + dy])
                .filter(([nx, ny]) => nx >= 0 && ny >= 0 && nx < width && ny < height && !holes[ny * width + nx])
                .map(([nx, ny]) => ny * width + nx);
        });
        const total = holes.filter(h => !h).length;
        return { width, height, diagonal, givens, holes, neighbours, total };
    },

    // A fresh value array: the givens, empty cells as 0 and holes as null
    start(puzzle) {
        return puzzle.givens.map((v, i) => (puzzle.holes[i] ? null : v));
    },

    adjacent(puzzle, a, b) {
        return puzzle.neighbours[a].includes(b);
    },

    // value → list of cell indexes holding it
    positions(values) {
        const at = new Map();
        values.forEach((v, i) => {
            if (!v) return;
            if (!at.has(v)) at.set(v, []);
            at.get(v).push(i);
        });
        return at;
    },

    /**
     * Finds broken rules: a number placed twice, and a number whose predecessor
     * or successor is placed but not next to it. Also lists the chain links:
     * pairs [a, b] of cells holding k and k + 1 next to each other.
     * Returns { bad: Set of cell indexes, links, filled }.
     */
    check(puzzle, values) {
        const at = this.positions(values);
        const bad = new Set();
        at.forEach(cells => { if (cells.length > 1) cells.forEach(c => bad.add(c)); });
        const links = [];
        values.forEach((v, i) => {
            if (!v) return;
            [v - 1, v + 1].forEach(w => {
                const others = at.get(w);
                if (!others) return;
                if (!others.some(o => this.adjacent(puzzle, i, o))) bad.add(i);
            });
            (at.get(v + 1) || []).forEach(o => { if (this.adjacent(puzzle, i, o)) links.push([i, o, v]); });
        });
        const filled = values.filter(v => v).length;
        return { bad, links, filled };
    },

    isSolved(puzzle, values) {
        const { bad, filled } = this.check(puzzle, values);
        return filled === puzzle.total && !bad.size;
    },

    // Numbers worth offering for an empty cell: one more / one less than a placed neighbour, if still unused
    candidates(puzzle, values, cell) {
        const used = new Set(values.filter(v => v));
        const out = new Set();
        puzzle.neighbours[cell].forEach(n => {
            const v = values[n];
            if (!v) return;
            [v - 1, v + 1].forEach(w => { if (w >= 1 && w <= puzzle.total && !used.has(w)) out.add(w); });
        });
        return [...out].sort((a, b) => a - b);
    },

    /**
     * Counts the solutions of a puzzle (stops at `limit`). Walks the chain from 1
     * upwards; each step must stay within reach of the next given number, and no
     * empty cell may be left with fewer than two usable neighbours.
     * onSolution(values), if given, receives a copy of each solution found.
     */
    countSolutions(puzzle, limit = 2, onSolution = null) {
        const N = puzzle.total;
        const values = this.start(puzzle);
        const pos = new Array(N + 2).fill(-1);
        values.forEach((v, i) => { if (v) pos[v] = i; });
        if (pos[1] < 0) return 0; // the generator always gives 1
        const nextGiven = new Array(N + 2).fill(N + 1);
        for (let v = N, g = N + 1; v >= 1; v--) {
            if (pos[v] >= 0) g = v;
            nextGiven[v] = g;
        }
        // distances between board cells (breadth-first search)
        const cells = values.map((v, i) => i).filter(i => values[i] !== null);
        const dist = new Map();
        cells.forEach(s => {
            const d = new Map([[s, 0]]);
            const queue = [s];
            for (let q = 0; q < queue.length; q++) {
                const u = queue[q];
                puzzle.neighbours[u].forEach(w => { if (!d.has(w)) { d.set(w, d.get(u) + 1); queue.push(w); } });
            }
            dist.set(s, d);
        });
        const givenAt = puzzle.givens;
        let count = 0;

        const usable = (u, head, k) => {
            let n = 0;
            for (const w of puzzle.neighbours[u]) {
                if (values[w] === 0 || w === head || givenAt[w] > k) n++;
                if (n >= 2) return true;
            }
            return false;
        };

        const solve = (k, c) => {
            if (count >= limit) return;
            if (k === N) { count++; if (onSolution) onSolution([...values]); return; }
            const nk = k + 1;
            if (pos[nk] >= 0) { // a given number: it must be next to k
                if (this.adjacent(puzzle, c, pos[nk])) solve(nk, pos[nk]);
                return;
            }
            const g = nextGiven[nk];
            const pg = g <= N ? pos[g] : -1;
            for (const v of puzzle.neighbours[c]) {
                if (values[v] !== 0) continue;
                if (pg >= 0) {
                    const d = dist.get(v).get(pg);
                    const steps = g - nk;
                    if (d === undefined || d > steps) continue;
                    if (!puzzle.diagonal && ((steps - d) & 1)) continue;
                }
                values[v] = nk;
                pos[nk] = v;
                if (puzzle.neighbours[c].every(u => values[u] !== 0 || usable(u, v, nk))) solve(nk, v);
                values[v] = 0;
                pos[nk] = -1;
                if (count >= limit) return;
            }
        };
        solve(1, pos[1]);
        return count;
    }
};
