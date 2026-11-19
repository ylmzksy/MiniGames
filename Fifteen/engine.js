/**
 * Fifteen engine: an n x n frame of tiles with one gap (0). Cells are a flat
 * array in reading order. A "move" is one tile sliding one cell into the gap,
 * so sliding a run of k tiles counts as k moves (the same unit the par uses).
 */
const FifteenEngine = {
    // Numbers in reading order 1..n²-1 with the gap last
    orderedTarget(n) {
        return Array.from({ length: n * n }, (_, i) => (i + 1) % (n * n));
    },

    parse(level) {
        const n = level.size;
        const start = level.start.flat();
        const target = level.target ? level.target.flat() : this.orderedTarget(n);
        return { n, start, target, par: level.par, picture: level.picture || null };
    },

    // Start and target are reachable from each other iff the permutation parity
    // matches the parity of the gap's taxicab distance
    isSolvable(n, start, target) {
        if (start.length !== n * n || [...start].sort((a, b) => a - b).join() !== [...target].sort((a, b) => a - b).join()) return false;
        const where = new Map(target.map((t, i) => [t, i]));
        const perm = start.map(t => where.get(t));
        let swaps = 0;
        const seen = new Array(perm.length).fill(false);
        for (let i = 0; i < perm.length; i++) {
            let len = 0;
            for (let j = i; !seen[j]; j = perm[j]) { seen[j] = true; len++; }
            if (len) swaps += len - 1;
        }
        const a = start.indexOf(0), b = target.indexOf(0);
        const gapDist = Math.abs(Math.floor(a / n) - Math.floor(b / n)) + Math.abs(a % n - b % n);
        return swaps % 2 === gapDist % 2;
    },

    // Tiles that slide when the tile at cell idx is tapped: every tile between it
    // and the gap, nearest the gap first. Returns [{tile, from, to}] or null.
    runTo(cells, n, idx) {
        const gap = cells.indexOf(0);
        if (idx === gap) return null;
        const gr = Math.floor(gap / n), gc = gap % n;
        const r = Math.floor(idx / n), c = idx % n;
        let step;
        if (r === gr) step = c < gc ? -1 : 1;
        else if (c === gc) step = r < gr ? -n : n;
        else return null;
        const moves = [];
        for (let to = gap, from = gap + step; ; to = from, from += step) {
            moves.push({ tile: cells[from], from, to });
            if (from === idx) break;
        }
        return moves;
    },

    // Arrow/swipe: the tile on the opposite side of the gap moves in direction dir
    cellForDirection(cells, n, dir) {
        const gap = cells.indexOf(0);
        const r = Math.floor(gap / n), c = gap % n;
        const src = { up: [r + 1, c], down: [r - 1, c], left: [r, c + 1], right: [r, c - 1] }[dir];
        if (!src) return -1;
        const [sr, sc] = src;
        return sr >= 0 && sr < n && sc >= 0 && sc < n ? sr * n + sc : -1;
    },

    apply(cells, moves) {
        moves.forEach(m => { cells[m.to] = m.tile; cells[m.from] = 0; });
    },

    revert(cells, moves) {
        [...moves].reverse().forEach(m => { cells[m.from] = m.tile; cells[m.to] = 0; });
    },

    isSolved(cells, target) {
        return cells.every((t, i) => t === target[i]);
    }
};
