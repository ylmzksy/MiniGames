/**
 * Columns. A column of three colored gems falls into a well. Move it left and
 * right, cycle the order of its gems, and drop it. When it lands, three or
 * more equal gems in a line (row, column or diagonal) vanish, gems above fall
 * down, and new lines formed that way count as a chain. The round is over
 * when a new column has no room to appear.
 */
const ColumnsEngine = {
    WIDTH: 6,
    HEIGHT: 13,

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
            colors: level.colors, target: level.target, cleared: 0, score: 0, chainBest: 0,
            piece: null, next: null, over: false, won: false, rand: this.rng(level.seed || 1)
        };
        state.next = this.randomGems(state);
        this.spawn(state);
        return state;
    },

    randomGems(state) {
        return Array.from({ length: 3 }, () => Math.floor(state.rand() * state.colors));
    },

    // A new column appears at the top middle; no room means the round is over
    spawn(state) {
        const col = Math.floor(state.width / 2);
        state.piece = { col, row: 0, gems: state.next };
        state.next = this.randomGems(state);
        if (state.cells[0][col] !== null || state.cells[1][col] !== null || state.cells[2][col] !== null) {
            state.over = true;
            state.piece = null;
        }
    },

    free(state, row, col) {
        return row >= 0 && row < state.height && col >= 0 && col < state.width && state.cells[row][col] === null;
    },

    move(state, dx) {
        const p = state.piece;
        if (!p || state.over || state.won) return false;
        const col = p.col + dx;
        if (![0, 1, 2].every(i => this.free(state, p.row + i, col))) return false;
        p.col = col;
        return true;
    },

    cycle(state) {
        const p = state.piece;
        if (!p || state.over || state.won) return false;
        p.gems = [p.gems[2], p.gems[0], p.gems[1]];
        return true;
    },

    // Moves the column down one row, or locks it; returns what happened
    drop(state) {
        const p = state.piece;
        if (!p || state.over || state.won) return 'idle';
        if (this.free(state, p.row + 3, p.col)) {
            p.row++;
            return 'moved';
        }
        p.gems.forEach((g, i) => { state.cells[p.row + i][p.col] = g; });
        state.piece = null;
        const chains = this.resolve(state);
        if (state.cleared >= state.target) state.won = true;
        else this.spawn(state);
        return chains ? 'cleared' : 'locked';
    },

    // Cells that are part of a line of three or more equal gems
    matches(state) {
        const out = new Set();
        const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
        for (let r = 0; r < state.height; r++) {
            for (let c = 0; c < state.width; c++) {
                const g = state.cells[r][c];
                if (g === null) continue;
                dirs.forEach(([dr, dc]) => {
                    const run = [[r, c]];
                    let nr = r + dr;
                    let nc = c + dc;
                    while (nr >= 0 && nr < state.height && nc >= 0 && nc < state.width && state.cells[nr][nc] === g) {
                        run.push([nr, nc]);
                        nr += dr;
                        nc += dc;
                    }
                    if (run.length >= 3) run.forEach(([a, b]) => out.add(`${a},${b}`));
                });
            }
        }
        return out;
    },

    gravity(state) {
        for (let c = 0; c < state.width; c++) {
            let write = state.height - 1;
            for (let r = state.height - 1; r >= 0; r--) {
                if (state.cells[r][c] !== null) {
                    const g = state.cells[r][c];
                    state.cells[r][c] = null;
                    state.cells[write][c] = g;
                    write--;
                }
            }
        }
    },

    // Clears lines repeatedly while new ones form; returns the number of chains
    resolve(state) {
        let chain = 0;
        while (true) {
            const found = this.matches(state);
            if (!found.size) break;
            chain++;
            found.forEach(key => { const [r, c] = key.split(',').map(Number); state.cells[r][c] = null; });
            state.cleared += found.size;
            state.score += found.size * 10 * chain;
            state.chainBest = Math.max(state.chainBest, chain);
            this.gravity(state);
        }
        return chain;
    }
};
