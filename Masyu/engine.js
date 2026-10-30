/**
 * Masyu. Draw one closed loop through cell centers that passes every circle:
 *   white circle: the loop goes straight through it and turns in the cell
 *                 right before it or right after it (or both)
 *   black circle: the loop turns at it and goes straight through the next
 *                 cell on both sides
 * Level map: 'W' white circle, 'B' black circle, '.' empty.
 * The player's lines are a Set of edge keys between neighboring cells.
 */
const MasyuEngine = {
    dirs: { up: [-1, 0], down: [1, 0], left: [0, -1], right: [0, 1] },
    opposite: { up: 'down', down: 'up', left: 'right', right: 'left' },

    parse(level) {
        const circles = new Map();
        level.map.forEach((row, r) => [...row].forEach((ch, c) => {
            if (ch === 'W' || ch === 'B') circles.set(`${r},${c}`, ch);
        }));
        return { width: level.map[0].length, height: level.map.length, circles };
    },

    edgeKey(a, b) {
        const [p, q] = [a, b].sort((x, y) => x[0] - y[0] || x[1] - y[1]);
        return `${p[0]},${p[1]}|${q[0]},${q[1]}`;
    },

    neighbor(puzzle, r, c, dir) {
        const [dr, dc] = this.dirs[dir];
        const nr = r + dr;
        const nc = c + dc;
        return nr >= 0 && nc >= 0 && nr < puzzle.height && nc < puzzle.width ? [nr, nc] : null;
    },

    // Directions in which (r, c) has a line
    lineDirs(puzzle, lines, r, c) {
        return Object.keys(this.dirs).filter(dir => {
            const n = this.neighbor(puzzle, r, c, dir);
            return n && lines.has(this.edgeKey([r, c], n));
        });
    },

    isStraight(ds) {
        return ds.length === 2 && this.opposite[ds[0]] === ds[1];
    },

    // A circle is 'bad' when the lines around it already break its rule,
    // 'ok' when its rule is fully met, '' while still open
    circleState(puzzle, lines, r, c) {
        const kind = puzzle.circles.get(`${r},${c}`);
        const ds = this.lineDirs(puzzle, lines, r, c);
        if (ds.length > 2) return 'bad';
        if (ds.length < 2) return '';
        const next = ds.map(d => ({ d, cell: this.neighbor(puzzle, r, c, d) }));
        if (kind === 'W') {
            if (!this.isStraight(ds)) return 'bad';
            const states = next.map(({ cell }) => {
                const nd = this.lineDirs(puzzle, lines, ...cell);
                return nd.length === 2 ? !this.isStraight(nd) : null; // true = turns, null = undecided
            });
            if (states.includes(true)) return 'ok';
            return states.includes(null) ? '' : 'bad';
        }
        if (this.isStraight(ds)) return 'bad';
        let open = false;
        for (const { d, cell } of next) {
            const nd = this.lineDirs(puzzle, lines, ...cell);
            if (nd.length === 2 && (!nd.includes(d) || !this.isStraight(nd))) return 'bad';
            if (nd.length < 2) open = true;
            if (nd.length === 1 && !nd.includes(this.opposite[d])) return 'bad';
        }
        return open ? '' : 'ok';
    },

    // Cells with an impossible number of lines (1, 3 or 4)
    badCells(puzzle, lines) {
        const bad = new Set();
        for (let r = 0; r < puzzle.height; r++) {
            for (let c = 0; c < puzzle.width; c++) {
                const n = this.lineDirs(puzzle, lines, r, c).length;
                if (n === 1 || n > 2) bad.add(`${r},${c}`);
            }
        }
        return bad;
    },

    // True when the lines form exactly one closed loop that visits every circle
    isSingleLoop(puzzle, lines) {
        if (!lines.size) return false;
        const adj = new Map();
        lines.forEach(key => {
            const [a, b] = key.split('|');
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
        if (seen.size !== adj.size) return false;
        return [...puzzle.circles.keys()].every(key => adj.has(key));
    },

    isSolved(puzzle, lines) {
        if (!this.isSingleLoop(puzzle, lines)) return false;
        return [...puzzle.circles.keys()].every(key => {
            const [r, c] = key.split(',').map(Number);
            return this.circleState(puzzle, lines, r, c) === 'ok';
        });
    }
};
