/**
 * Flood It. The region connected to the top-left corner takes the color you
 * choose, swallowing every neighboring cell of that color. Turn the whole
 * board into one color within the move limit.
 */
const FloodEngine = {
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
        const rand = this.rng(level.seed);
        const board = Array.from({ length: level.size }, () => Array.from({ length: level.size }, () => Math.floor(rand() * level.colors)));
        return { size: level.size, colors: level.colors, board, moves: 0, limit: level.moves };
    },

    // Cells connected to the top-left corner through the corner's color
    region(board) {
        const n = board.length;
        const color = board[0][0];
        const seen = new Set(['0,0']);
        const queue = [[0, 0]];
        while (queue.length) {
            const [r, c] = queue.shift();
            [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]].forEach(([nr, nc]) => {
                if (nr < 0 || nc < 0 || nr >= n || nc >= n || seen.has(`${nr},${nc}`) || board[nr][nc] !== color) return;
                seen.add(`${nr},${nc}`);
                queue.push([nr, nc]);
            });
        }
        return seen;
    },

    // Returns true when the flood changed anything
    flood(state, color) {
        if (color === state.board[0][0]) return false;
        this.region(state.board).forEach(key => { const [r, c] = key.split(',').map(Number); state.board[r][c] = color; });
        state.moves++;
        return true;
    },

    isSolved(board) {
        const v = board[0][0];
        return board.every(row => row.every(x => x === v));
    },

    // Greedy solver: always pick the color that grows the region most; used to set fair limits
    greedyMoves(level) {
        const state = this.create(level);
        let moves = 0;
        while (!this.isSolved(state.board) && moves < 200) {
            let best = -1;
            let bestSize = -1;
            for (let color = 0; color < state.colors; color++) {
                if (color === state.board[0][0]) continue;
                const copy = state.board.map(row => [...row]);
                this.region(copy).forEach(key => { const [r, c] = key.split(',').map(Number); copy[r][c] = color; });
                const size = this.region(copy).size;
                if (size > bestSize) { bestSize = size; best = color; }
            }
            this.flood(state, best);
            moves++;
        }
        return moves;
    }
};
