/**
 * Capsules (in the style of Dr. Mario). A bottle holds colored viruses.
 * Two-colored capsules fall in; move and rotate them. Four or more cells of
 * one color in a row or column (capsule halves and viruses alike) clear.
 * Half capsules left on their own fall down. The level is won when every
 * virus is gone, and lost when a new capsule has no room to appear.
 * Row 0 is a hidden row above the bottle neck.
 */
const CapsulesEngine = {
    WIDTH: 8,
    HEIGHT: 17,   // row 0 hidden

    rng(seed) {
        let a = seed >>> 0;
        return () => {
            a = (a + 0x6D2B79F5) >>> 0;
            let t = a;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    },

    create(level) {
        const state = {
            width: this.WIDTH, height: this.HEIGHT,
            cells: Array.from({ length: this.HEIGHT }, () => Array(this.WIDTH).fill(null)),
            colors: level.colors, virusesTotal: level.viruses, score: 0, chainBest: 0,
            piece: null, next: null, over: false, won: false, rand: this.rng(level.seed || 1)
        };
        this.placeViruses(state, level.viruses);
        state.next = this.randomCapsule(state);
        this.spawn(state);
        return state;
    },

    // Viruses go in the lower part of the bottle, never three alike in a line
    placeViruses(state, count) {
        let placed = 0;
        let guard = 0;
        while (placed < count && guard++ < 5000) {
            const r = 7 + Math.floor(state.rand() * (state.height - 7));
            const c = Math.floor(state.rand() * state.width);
            if (state.cells[r][c]) continue;
            const color = Math.floor(state.rand() * state.colors);
            state.cells[r][c] = { color, virus: true, link: null };
            if (this.runLength(state, r, c, color) >= 3) { state.cells[r][c] = null; continue; }
            placed++;
        }
    },

    runLength(state, r, c, color) {
        let best = 1;
        [[0, 1], [1, 0]].forEach(([dr, dc]) => {
            let n = 1;
            for (const s of [1, -1]) {
                let nr = r + dr * s;
                let nc = c + dc * s;
                while (nr >= 0 && nr < state.height && nc >= 0 && nc < state.width && state.cells[nr][nc] && state.cells[nr][nc].color === color) { n++; nr += dr * s; nc += dc * s; }
            }
            best = Math.max(best, n);
        });
        return best;
    },

    virusesLeft(state) {
        return state.cells.flat().filter(x => x && x.virus).length;
    },

    randomCapsule(state) {
        return [Math.floor(state.rand() * state.colors), Math.floor(state.rand() * state.colors)];
    },

    // Capsule cells: orientation 0 = horizontal (a left, b right), 1 = vertical (a bottom, b top),
    // 2 = horizontal (b left, a right), 3 = vertical (b bottom, a top)
    cellsOf(piece, row = piece.row, col = piece.col, orient = piece.orient) {
        const [a, b] = piece.colors;
        switch (orient) {
            case 0: return [[row, col, a], [row, col + 1, b]];
            case 1: return [[row, col, a], [row - 1, col, b]];
            case 2: return [[row, col, b], [row, col + 1, a]];
            default: return [[row, col, b], [row - 1, col, a]];
        }
    },

    free(state, row, col) {
        return row >= 0 && row < state.height && col >= 0 && col < state.width && state.cells[row][col] === null;
    },

    fits(state, piece, row, col, orient) {
        return this.cellsOf(piece, row, col, orient).every(([r, c]) => this.free(state, r, c));
    },

    spawn(state) {
        state.piece = { row: 1, col: 3, orient: 0, colors: state.next };
        state.next = this.randomCapsule(state);
        if (!this.fits(state, state.piece, 1, 3, 0)) {
            state.over = true;
            state.piece = null;
        }
    },

    move(state, dx) {
        const p = state.piece;
        if (!p || state.over || state.won) return false;
        if (!this.fits(state, p, p.row, p.col + dx, p.orient)) return false;
        p.col += dx;
        return true;
    },

    rotate(state) {
        const p = state.piece;
        if (!p || state.over || state.won) return false;
        const orient = (p.orient + 1) % 4;
        for (const kc of [0, -1, 1]) {
            if (this.fits(state, p, p.row, p.col + kc, orient)) {
                p.col += kc;
                p.orient = orient;
                return true;
            }
        }
        return false;
    },

    drop(state) {
        const p = state.piece;
        if (!p || state.over || state.won) return 'idle';
        if (this.fits(state, p, p.row + 1, p.col, p.orient)) {
            p.row++;
            return 'moved';
        }
        const cells = this.cellsOf(p);
        const [[r1, c1, col1], [r2, c2, col2]] = cells;
        state.cells[r1][c1] = { color: col1, virus: false, link: [r2 - r1, c2 - c1] };
        state.cells[r2][c2] = { color: col2, virus: false, link: [r1 - r2, c1 - c2] };
        state.piece = null;
        const chains = this.resolve(state);
        if (this.virusesLeft(state) === 0) state.won = true;
        else this.spawn(state);
        return chains ? 'cleared' : 'locked';
    },

    // Cells in runs of four or more of one color, horizontally or vertically
    matches(state) {
        const out = new Set();
        for (let r = 0; r < state.height; r++) {
            for (let c = 0; c < state.width; c++) {
                const x = state.cells[r][c];
                if (!x) continue;
                [[0, 1], [1, 0]].forEach(([dr, dc]) => {
                    const run = [[r, c]];
                    let nr = r + dr;
                    let nc = c + dc;
                    while (nr < state.height && nc < state.width && state.cells[nr][nc] && state.cells[nr][nc].color === x.color) { run.push([nr, nc]); nr += dr; nc += dc; }
                    if (run.length >= 4) run.forEach(([a, b]) => out.add(`${a},${b}`));
                });
            }
        }
        return out;
    },

    // Capsule pieces fall (linked halves together, lone halves alone); viruses never move
    gravity(state) {
        let moved = true;
        while (moved) {
            moved = false;
            for (let r = state.height - 2; r >= 0; r--) {
                for (let c = 0; c < state.width; c++) {
                    const x = state.cells[r][c];
                    if (!x || x.virus) continue;
                    let group;
                    if (!x.link) group = [[r, c]];
                    else if (x.link[0] === 0) { if (x.link[1] < 0) continue; group = [[r, c], [r, c + 1]]; } // horizontal: driven by the left half
                    else if (x.link[0] === -1) group = [[r, c], [r - 1, c]]; // vertical: driven by the lower half
                    else continue; // upper half of a vertical capsule
                    const inGroup = (a, b) => group.some(([gr, gc]) => gr === a && gc === b);
                    const canFall = group.every(([gr, gc]) => gr + 1 < state.height && (state.cells[gr + 1][gc] === null || inGroup(gr + 1, gc)));
                    if (!canFall) continue;
                    group.sort((p, q) => q[0] - p[0]).forEach(([gr, gc]) => { state.cells[gr + 1][gc] = state.cells[gr][gc]; state.cells[gr][gc] = null; });
                    moved = true;
                }
            }
        }
    },

    resolve(state) {
        let chain = 0;
        while (true) {
            const found = this.matches(state);
            if (!found.size) break;
            chain++;
            let viruses = 0;
            found.forEach(key => {
                const [r, c] = key.split(',').map(Number);
                const x = state.cells[r][c];
                if (x.virus) viruses++;
                if (x.link) { const pr = r + x.link[0]; const pc = c + x.link[1]; const partner = state.cells[pr]?.[pc]; if (partner && !found.has(`${pr},${pc}`)) partner.link = null; }
                state.cells[r][c] = null;
            });
            state.score += (found.size * 10 + viruses * 100) * chain;
            state.chainBest = Math.max(state.chainBest, chain);
            this.gravity(state);
        }
        return chain;
    }
};
