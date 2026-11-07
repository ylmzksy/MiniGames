/**
 * Match-3. A board of gems; swap two neighbors to line up three or more of
 * a color in a row or column. Matches clear, gems above fall down, new gems
 * drop in, and chains score more. Reach the target score within the moves.
 */
const Match3Engine = {
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
        const state = { width: 8, height: 8, colors: level.colors, rand: this.rng(level.seed), board: [], score: 0, moves: level.moves, target: level.target };
        this.fill(state);
        if (!this.hasMoves(state.board)) this.reshuffle(state);
        return state;
    },

    // Fills the board top to bottom without creating any match
    fill(state) {
        const { width, height, colors, rand } = state;
        state.board = Array.from({ length: height }, () => Array(width).fill(-1));
        for (let r = 0; r < height; r++) {
            for (let c = 0; c < width; c++) {
                let color;
                do {
                    color = Math.floor(rand() * colors);
                } while ((c >= 2 && state.board[r][c - 1] === color && state.board[r][c - 2] === color)
                    || (r >= 2 && state.board[r - 1][c] === color && state.board[r - 2][c] === color));
                state.board[r][c] = color;
            }
        }
    },

    reshuffle(state) {
        for (let i = 0; i < 50; i++) {
            this.fill(state);
            if (this.hasMoves(state.board)) return true;
        }
        return false;
    },

    // Cells that belong to a run of three or more, as "r,c" keys
    findMatches(board) {
        const matched = new Set();
        const height = board.length;
        const width = board[0].length;
        for (let r = 0; r < height; r++) {
            for (let c = 0; c < width; c++) {
                const v = board[r][c];
                if (v < 0) continue;
                if (c + 2 < width && board[r][c + 1] === v && board[r][c + 2] === v) {
                    let k = c;
                    while (k < width && board[r][k] === v) { matched.add(`${r},${k}`); k++; }
                }
                if (r + 2 < height && board[r + 1][c] === v && board[r + 2][c] === v) {
                    let k = r;
                    while (k < height && board[k][c] === v) { matched.add(`${k},${c}`); k++; }
                }
            }
        }
        return matched;
    },

    swap(board, a, b) {
        const t = board[a[0]][a[1]];
        board[a[0]][a[1]] = board[b[0]][b[1]];
        board[b[0]][b[1]] = t;
    },

    swapMakesMatch(board, a, b) {
        this.swap(board, a, b);
        const ok = this.findMatches(board).size > 0;
        this.swap(board, a, b);
        return ok;
    },

    hasMoves(board) {
        const height = board.length;
        const width = board[0].length;
        for (let r = 0; r < height; r++) {
            for (let c = 0; c < width; c++) {
                if (c + 1 < width && this.swapMakesMatch(board, [r, c], [r, c + 1])) return true;
                if (r + 1 < height && this.swapMakesMatch(board, [r, c], [r + 1, c])) return true;
            }
        }
        return false;
    },

    // Removes the matched cells, drops the gems above and refills from the top
    collapse(state, matched) {
        const { board, width, height, rand, colors } = state;
        matched.forEach(key => { const [r, c] = key.split(',').map(Number); board[r][c] = -1; });
        for (let c = 0; c < width; c++) {
            let write = height - 1;
            for (let r = height - 1; r >= 0; r--) {
                if (board[r][c] >= 0) { board[write][c] = board[r][c]; write--; }
            }
            for (let r = write; r >= 0; r--) board[r][c] = Math.floor(rand() * colors);
        }
    },

    // One cascade step: clears current matches and returns how many gems went
    step(state, chain) {
        const matched = this.findMatches(state.board);
        if (!matched.size) return 0;
        state.score += matched.size * 10 * chain;
        this.collapse(state, matched);
        return matched.size;
    },

    // Resolves every cascade at once; returns the number of chain steps
    resolveAll(state) {
        let chain = 1;
        while (this.step(state, chain)) chain++;
        if (!this.hasMoves(state.board)) this.reshuffle(state);
        return chain - 1;
    }
};
