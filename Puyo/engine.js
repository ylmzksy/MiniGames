/**
 * Puyo Puyo. Pairs of colored blobs fall into a well. Move and rotate the
 * pair; when it lands, any group of four or more same-colored blobs touching
 * orthogonally pops, blobs above fall, and groups formed by the fall pop as a
 * chain. Row 0 is a hidden row above the visible well; the round is over
 * when the pivot's spawn cell is blocked.
 */
const PuyoEngine = {
    WIDTH: 6,
    HEIGHT: 13,   // row 0 is hidden
    OFFSETS: [[-1, 0], [0, 1], [1, 0], [0, -1]], // child position for orientations up, right, down, left

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
            colors: level.colors, target: level.target, popped: 0, score: 0, chainBest: 0,
            piece: null, next: null, over: false, won: false, rand: this.rng(level.seed || 1)
        };
        state.next = this.randomPair(state);
        this.spawn(state);
        return state;
    },

    randomPair(state) {
        return [Math.floor(state.rand() * state.colors), Math.floor(state.rand() * state.colors)];
    },

    spawn(state) {
        const col = 2;
        state.piece = { row: 1, col, orient: 0, colors: state.next };
        state.next = this.randomPair(state);
        if (state.cells[1][col] !== null || state.cells[0][col] !== null) {
            state.over = true;
            state.piece = null;
        }
    },

    free(state, row, col) {
        return row >= 0 && row < state.height && col >= 0 && col < state.width && state.cells[row][col] === null;
    },

    childPos(piece, orient = piece.orient) {
        const [dr, dc] = this.OFFSETS[orient];
        return [piece.row + dr, piece.col + dc];
    },

    fits(state, row, col, orient) {
        const [dr, dc] = this.OFFSETS[orient];
        return this.free(state, row, col) && this.free(state, row + dr, col + dc);
    },

    move(state, dx) {
        const p = state.piece;
        if (!p || state.over || state.won) return false;
        if (!this.fits(state, p.row, p.col + dx, p.orient)) return false;
        p.col += dx;
        return true;
    },

    // Rotates around the pivot; kicks sideways (or up) when the wall or a blob is in the way
    rotate(state, dir) {
        const p = state.piece;
        if (!p || state.over || state.won) return false;
        const orient = (p.orient + dir + 4) % 4;
        for (const [kr, kc] of [[0, 0], [0, -1], [0, 1], [-1, 0]]) {
            if (this.fits(state, p.row + kr, p.col + kc, orient)) {
                p.row += kr;
                p.col += kc;
                p.orient = orient;
                return true;
            }
        }
        return false;
    },

    // Moves the pair down one row or locks it; returns what happened
    drop(state) {
        const p = state.piece;
        if (!p || state.over || state.won) return 'idle';
        if (this.fits(state, p.row + 1, p.col, p.orient)) {
            p.row++;
            return 'moved';
        }
        const [cr, cc] = this.childPos(p);
        state.cells[p.row][p.col] = p.colors[0];
        state.cells[cr][cc] = p.colors[1];
        state.piece = null;
        this.gravity(state);
        const chains = this.resolve(state);
        if (state.popped >= state.target) state.won = true;
        else this.spawn(state);
        return chains ? 'cleared' : 'locked';
    },

    gravity(state) {
        for (let c = 0; c < state.width; c++) {
            let write = state.height - 1;
            for (let r = state.height - 1; r >= 0; r--) {
                if (state.cells[r][c] !== null) {
                    const v = state.cells[r][c];
                    state.cells[r][c] = null;
                    state.cells[write][c] = v;
                    write--;
                }
            }
        }
    },

    // Groups of four or more connected blobs (the hidden row does not count)
    groups(state) {
        const seen = new Set();
        const out = [];
        for (let r = 1; r < state.height; r++) {
            for (let c = 0; c < state.width; c++) {
                const v = state.cells[r][c];
                if (v === null || seen.has(`${r},${c}`)) continue;
                const group = [];
                const queue = [[r, c]];
                seen.add(`${r},${c}`);
                while (queue.length) {
                    const [cr, cc] = queue.pop();
                    group.push([cr, cc]);
                    [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dr, dc]) => {
                        const nr = cr + dr;
                        const nc = cc + dc;
                        if (nr < 1 || nr >= state.height || nc < 0 || nc >= state.width) return;
                        if (state.cells[nr][nc] !== v || seen.has(`${nr},${nc}`)) return;
                        seen.add(`${nr},${nc}`);
                        queue.push([nr, nc]);
                    });
                }
                if (group.length >= 4) out.push(group);
            }
        }
        return out;
    },

    resolve(state) {
        let chain = 0;
        while (true) {
            const found = this.groups(state);
            if (!found.length) break;
            chain++;
            let count = 0;
            found.forEach(group => group.forEach(([r, c]) => { state.cells[r][c] = null; count++; }));
            state.popped += count;
            state.score += count * 10 * (chain * chain);
            state.chainBest = Math.max(state.chainBest, chain);
            this.gravity(state);
        }
        return chain;
    }
};
