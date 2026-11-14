/**
 * Pentominoes. Cover every cell of the target region with the given polyomino
 * pieces. Pieces may be rotated and flipped; they never overlap and must stay
 * inside the region. Cells are [row, col] pairs; a piece's cells are kept
 * normalized so its top-left bounding corner is [0, 0].
 */
const PentominoEngine = {
    normalize(cells) {
        const mr = Math.min(...cells.map(c => c[0]));
        const mc = Math.min(...cells.map(c => c[1]));
        return cells.map(([r, c]) => [r - mr, c - mc]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    },

    // Rotates 90° clockwise; also returns where a tracked cell ends up
    rotate(cells, track) {
        const turned = cells.map(([r, c]) => [c, -r]);
        const mr = Math.min(...turned.map(c => c[0]));
        const mc = Math.min(...turned.map(c => c[1]));
        return { cells: this.normalize(turned), track: track ? [track[1] - mr, -track[0] - mc] : null };
    },

    flip(cells, track) {
        const mirrored = cells.map(([r, c]) => [r, -c]);
        const mc = Math.min(...mirrored.map(c => c[1]));
        return { cells: this.normalize(mirrored), track: track ? [track[0], -track[1] - mc] : null };
    },

    key(cells) {
        return cells.map(c => c.join(',')).join('|');
    },

    orientations(cells) {
        const seen = new Map();
        let cur = this.normalize(cells);
        for (let f = 0; f < 2; f++) {
            for (let r = 0; r < 4; r++) {
                seen.set(this.key(cur), cur);
                cur = this.rotate(cur).cells;
            }
            cur = this.flip(cur).cells;
        }
        return [...seen.values()];
    },

    parse(level, pieces) {
        const region = new Set();
        level.region.forEach((row, r) => [...row].forEach((ch, c) => { if (ch === '#') region.add(`${r},${c}`); }));
        return {
            width: level.region[0].length,
            height: level.region.length,
            region,
            pieces: pieces.map((p, i) => ({ id: i, name: p.name, cells: this.normalize(p.cells) })),
            // placed[i] = { cells (oriented), r, c } or null
            placed: pieces.map(() => null),
            // current orientation of each piece in the tray
            shapes: pieces.map(p => this.normalize(p.cells))
        };
    },

    occupied(state, except = -1) {
        const set = new Set();
        state.placed.forEach((p, i) => {
            if (p && i !== except) p.cells.forEach(([r, c]) => set.add(`${p.r + r},${p.c + c}`));
        });
        return set;
    },

    canPlace(state, idx, cells, r, c) {
        const taken = this.occupied(state, idx);
        return cells.every(([dr, dc]) => {
            const key = `${r + dr},${c + dc}`;
            return state.region.has(key) && !taken.has(key);
        });
    },

    place(state, idx, cells, r, c) {
        if (!this.canPlace(state, idx, cells, r, c)) return false;
        state.placed[idx] = { cells, r, c };
        state.shapes[idx] = cells;
        return true;
    },

    lift(state, idx) {
        state.placed[idx] = null;
    },

    coverage(state) {
        return this.occupied(state).size;
    },

    isSolved(state) {
        return this.coverage(state) === state.region.size;
    },

    // Backtracking solver over the first free cell; returns placements or null
    solve(state) {
        const free = new Set(state.region);
        const orients = state.pieces.map(p => this.orientations(p.cells));
        const result = [];
        const rec = (left) => {
            if (!free.size) return true;
            const [r0, c0] = [...free].map(k => k.split(',').map(Number)).sort((a, b) => a[0] - b[0] || a[1] - b[1])[0];
            for (const i of left) {
                for (const o of orients[i]) {
                    for (const [ar, ac] of o) {
                        const cells = o.map(([r, c]) => [r0 + r - ar, c0 + c - ac]);
                        if (!cells.every(([r, c]) => free.has(`${r},${c}`))) continue;
                        cells.forEach(([r, c]) => free.delete(`${r},${c}`));
                        result.push({ idx: i, cells: o, r: r0 - ar, c: c0 - ac });
                        if (rec(left.filter(x => x !== i))) return true;
                        result.pop();
                        cells.forEach(([r, c]) => free.add(`${r},${c}`));
                    }
                }
            }
            return false;
        };
        return rec(state.pieces.map(p => p.id)) ? result : null;
    }
};

// The twelve pentominoes, named by the letters they resemble
PentominoEngine.SHAPES = {
    F: [[0, 1], [0, 2], [1, 0], [1, 1], [2, 1]], I: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]],
    L: [[0, 0], [1, 0], [2, 0], [3, 0], [3, 1]], N: [[0, 1], [1, 1], [2, 0], [2, 1], [3, 0]],
    P: [[0, 0], [0, 1], [1, 0], [1, 1], [2, 0]], T: [[0, 0], [0, 1], [0, 2], [1, 1], [2, 1]],
    U: [[0, 0], [0, 2], [1, 0], [1, 1], [1, 2]], V: [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2]],
    W: [[0, 0], [1, 0], [1, 1], [2, 1], [2, 2]], X: [[0, 1], [1, 0], [1, 1], [1, 2], [2, 1]],
    Y: [[0, 1], [1, 0], [1, 1], [2, 1], [3, 1]], Z: [[0, 0], [0, 1], [1, 1], [2, 1], [2, 2]]
};
