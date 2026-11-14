/**
 * Pattern Blocks on a triangular lattice. A unit triangle is addressed by
 * (x, y, o): lattice point P = x*a + y*b with basis a = (1, 0) and
 * b = (1/2, √3/2); o = 0 is the "up" triangle P, P+a, P+b and o = 1 the
 * "down" triangle P+a, P+a+b, P+b. Pieces are sets of such triangles;
 * rotating by 60° keeps them on the lattice. A level's target is the union of
 * its stored solution placements, so every level is exactly solvable.
 */
const PatternEngine = {
    pieces: {
        triangle: { cells: [[0, 0, 0]], color: '#2ba84a', name: 'triangle' },
        rhombus: { cells: [[0, 0, 0], [0, 0, 1]], color: '#2f6fe4', name: 'rhombus' },
        trapezoid: { cells: [[0, 0, 0], [0, 0, 1], [1, 0, 0]], color: '#d9403a', name: 'trapezoid' },
        hexagon: { cells: [[0, 0, 0], [-1, 0, 0], [0, -1, 0], [-1, 0, 1], [0, -1, 1], [-1, -1, 1]], color: '#f2c233', name: 'hexagon' }
    },

    key([x, y, o]) {
        return `${x},${y},${o}`;
    },

    // Rotates a triangle 60° counterclockwise about the lattice origin
    rotate([x, y, o]) {
        const rx = -y;
        const ry = x + y;
        return o === 0 ? [rx - 1, ry, 1] : [rx - 1, ry + 1, 0];
    },

    // Triangles covered by a piece placed with its anchor at (x, y) and rotated k times
    cells(type, x, y, k) {
        let cells = this.pieces[type].cells.map(c => [...c]);
        for (let i = 0; i < ((k % 6) + 6) % 6; i++) cells = cells.map(c => this.rotate(c));
        return cells.map(([cx, cy, o]) => [cx + x, cy + y, o]);
    },

    // Screen coordinates of lattice point (x, y), y pointing up on the lattice
    point(x, y) {
        return [x + y / 2, -y * Math.sqrt(3) / 2];
    },

    vertices([x, y, o]) {
        const P = [x, y];
        return o === 0
            ? [this.point(x, y), this.point(x + 1, y), this.point(x, y + 1)]
            : [this.point(x + 1, y), this.point(x + 1, y + 1), this.point(x, y + 1)];
    },

    // Which lattice triangle contains the lattice-space point (u, v) given in basis coordinates
    triangleAt(u, v) {
        const x = Math.floor(u);
        const y = Math.floor(v);
        return (u - x) + (v - y) < 1 ? [x, y, 0] : [x, y, 1];
    },

    // Converts screen (sx, sy) in lattice units back to basis coordinates
    basis(sx, sy) {
        const v = -sy * 2 / Math.sqrt(3);
        return [sx - v / 2, v];
    },

    create(level) {
        const target = new Set();
        level.solution.forEach(([type, x, y, k]) => this.cells(type, x, y, k).forEach(c => target.add(this.key(c))));
        const tray = {};
        level.solution.forEach(([type]) => { tray[type] = (tray[type] || 0) + 1; });
        return { target, tray, placed: [] }; // placed: [{ type, x, y, k, cells }]
    },

    covered(state) {
        const set = new Set();
        state.placed.forEach(p => p.cells.forEach(c => set.add(this.key(c))));
        return set;
    },

    canPlace(state, type, x, y, k) {
        if (!state.tray[type]) return false;
        const covered = this.covered(state);
        return this.cells(type, x, y, k).every(c => state.target.has(this.key(c)) && !covered.has(this.key(c)));
    },

    place(state, type, x, y, k) {
        if (!this.canPlace(state, type, x, y, k)) return false;
        state.placed.push({ type, x, y, k, cells: this.cells(type, x, y, k) });
        state.tray[type]--;
        return true;
    },

    lift(state, index) {
        const [p] = state.placed.splice(index, 1);
        state.tray[p.type]++;
        return p;
    },

    placedAt(state, cell) {
        const key = this.key(cell);
        return state.placed.findIndex(p => p.cells.some(c => this.key(c) === key));
    },

    isSolved(state) {
        return this.covered(state).size === state.target.size;
    },

    // Exact-cover search: fills a target with the given multiset of pieces; returns placements or null
    solve(target, counts) {
        const targetKeys = [...target];
        const parse = k => k.split(',').map(Number);
        const used = new Set();
        const tray = { ...counts };
        const out = [];
        const rec = () => {
            const first = targetKeys.find(k => !used.has(k));
            if (!first) return true;
            const cell = parse(first);
            for (const type of Object.keys(tray)) {
                if (!tray[type]) continue;
                for (let k = 0; k < 6; k++) {
                    const base = this.cells(type, 0, 0, k);
                    for (const anchorCell of base) {
                        if (anchorCell[2] !== cell[2]) continue;
                        const dx = cell[0] - anchorCell[0];
                        const dy = cell[1] - anchorCell[1];
                        const cells = base.map(([cx, cy, o]) => [cx + dx, cy + dy, o]);
                        if (!cells.every(c => target.has(this.key(c)) && !used.has(this.key(c)))) continue;
                        cells.forEach(c => used.add(this.key(c)));
                        tray[type]--;
                        out.push([type, dx, dy, k]);
                        if (rec()) return true;
                        out.pop();
                        tray[type]++;
                        cells.forEach(c => used.delete(this.key(c)));
                    }
                }
            }
            return false;
        };
        return rec() ? out : null;
    }
};
