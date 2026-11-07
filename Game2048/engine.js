/**
 * 2048. Slide all tiles in one direction; equal tiles that collide merge into
 * their sum (each tile merges at most once per move) and a new 2 or 4 appears.
 * The level is won when a tile reaches the target; the game is over when no
 * move changes the board.
 */
const Engine2048 = {
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
        const state = { size: 4, board: Array.from({ length: 4 }, () => Array(4).fill(0)), score: 0, target: level.target, rand: this.rng(level.seed) };
        this.spawn(state);
        this.spawn(state);
        return state;
    },

    spawn(state) {
        const empty = [];
        state.board.forEach((row, r) => row.forEach((v, c) => { if (!v) empty.push([r, c]); }));
        if (!empty.length) return false;
        const [r, c] = empty[Math.floor(state.rand() * empty.length)];
        state.board[r][c] = state.rand() < 0.9 ? 2 : 4;
        return true;
    },

    // Slides one line toward index 0; returns the new line and the points gained
    slideLine(line) {
        const tiles = line.filter(v => v);
        const out = [];
        let gained = 0;
        for (let i = 0; i < tiles.length; i++) {
            if (i + 1 < tiles.length && tiles[i] === tiles[i + 1]) {
                out.push(tiles[i] * 2);
                gained += tiles[i] * 2;
                i++;
            } else {
                out.push(tiles[i]);
            }
        }
        while (out.length < line.length) out.push(0);
        return { line: out, gained };
    },

    lines(board, dir) {
        const n = board.length;
        const out = [];
        for (let i = 0; i < n; i++) {
            const cells = [];
            for (let j = 0; j < n; j++) {
                if (dir === 'left') cells.push([i, j]);
                else if (dir === 'right') cells.push([i, n - 1 - j]);
                else if (dir === 'up') cells.push([j, i]);
                else cells.push([n - 1 - j, i]);
            }
            out.push(cells);
        }
        return out;
    },

    // Applies a move; returns whether anything moved
    move(state, dir) {
        let moved = false;
        let gained = 0;
        this.lines(state.board, dir).forEach(cells => {
            const values = cells.map(([r, c]) => state.board[r][c]);
            const result = this.slideLine(values);
            gained += result.gained;
            cells.forEach(([r, c], i) => {
                if (state.board[r][c] !== result.line[i]) moved = true;
                state.board[r][c] = result.line[i];
            });
        });
        if (moved) { state.score += gained; this.spawn(state); }
        return moved;
    },

    canMove(board) {
        const n = board.length;
        for (let r = 0; r < n; r++) {
            for (let c = 0; c < n; c++) {
                if (!board[r][c]) return true;
                if (c + 1 < n && board[r][c] === board[r][c + 1]) return true;
                if (r + 1 < n && board[r][c] === board[r + 1][c]) return true;
            }
        }
        return false;
    },

    maxTile(board) {
        return Math.max(...board.flat());
    }
};
