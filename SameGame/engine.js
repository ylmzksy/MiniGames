/**
 * SameGame. Tap a group of two or more touching blocks of one color to remove
 * it; blocks above fall down and empty columns close up to the left. A group
 * of n blocks scores (n-2)^2. The round ends when no group is left.
 */
const SameGameEngine = {
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
        const board = Array.from({ length: level.rows }, () => Array.from({ length: level.cols }, () => Math.floor(rand() * level.colors)));
        return { rows: level.rows, cols: level.cols, colors: level.colors, board, score: 0, target: level.target, removed: 0, total: level.rows * level.cols };
    },

    // Connected blocks of the same color as (r, c), as [r, c] pairs
    group(board, r, c) {
        const color = board[r]?.[c];
        if (color === undefined || color < 0) return [];
        const seen = new Set([`${r},${c}`]);
        const out = [[r, c]];
        const queue = [[r, c]];
        while (queue.length) {
            const [cr, cc] = queue.shift();
            [[cr - 1, cc], [cr + 1, cc], [cr, cc - 1], [cr, cc + 1]].forEach(([nr, nc]) => {
                if (board[nr]?.[nc] === color && !seen.has(`${nr},${nc}`)) { seen.add(`${nr},${nc}`); out.push([nr, nc]); queue.push([nr, nc]); }
            });
        }
        return out;
    },

    remove(state, cells) {
        if (cells.length < 2) return 0;
        const { board, rows, cols } = state;
        cells.forEach(([r, c]) => { board[r][c] = -1; });
        // gravity within columns
        for (let c = 0; c < cols; c++) {
            let write = rows - 1;
            for (let r = rows - 1; r >= 0; r--) {
                if (board[r][c] >= 0) { board[write][c] = board[r][c]; if (write !== r) board[r][c] = -1; write--; }
            }
        }
        // empty columns close to the left
        let writeCol = 0;
        for (let c = 0; c < cols; c++) {
            const empty = board.every(row => row[c] < 0);
            if (empty) continue;
            if (writeCol !== c) {
                for (let r = 0; r < rows; r++) { board[r][writeCol] = board[r][c]; board[r][c] = -1; }
            }
            writeCol++;
        }
        const gained = (cells.length - 2) ** 2;
        state.score += gained;
        state.removed += cells.length;
        return gained;
    },

    // All removable groups (one representative cell each)
    groups(board) {
        const seen = new Set();
        const out = [];
        board.forEach((row, r) => row.forEach((v, c) => {
            if (v < 0 || seen.has(`${r},${c}`)) return;
            const g = this.group(board, r, c);
            g.forEach(([gr, gc]) => seen.add(`${gr},${gc}`));
            if (g.length >= 2) out.push(g);
        }));
        return out;
    },

    hasMoves(board) {
        return this.groups(board).length > 0;
    },

    isCleared(board) {
        return board.every(row => row.every(v => v < 0));
    }
};
