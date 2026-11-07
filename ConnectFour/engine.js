/**
 * Connect Four. Discs drop to the lowest free cell of a column; four in a
 * row (any direction) wins, a full board is a draw. Player 1 is you, 2 the AI.
 * The AI uses alpha-beta search with iterative deepening inside a time budget
 * and an evaluation that scores every window of four cells.
 */
const ConnectFourEngine = {
    create(level) {
        return { rows: level.rows, cols: level.cols, cells: Array.from({ length: level.rows }, () => Array(level.cols).fill(0)), last: null };
    },

    clone(b) {
        return { rows: b.rows, cols: b.cols, cells: b.cells.map(r => [...r]), last: b.last };
    },

    canDrop(b, c) {
        return c >= 0 && c < b.cols && b.cells[0][c] === 0;
    },

    landingRow(b, c) {
        for (let r = b.rows - 1; r >= 0; r--) if (b.cells[r][c] === 0) return r;
        return -1;
    },

    drop(b, c, who) {
        const r = this.landingRow(b, c);
        if (r < 0) return null;
        const next = this.clone(b);
        next.cells[r][c] = who;
        next.last = [r, c];
        return next;
    },

    // All windows of four cells, cached per board size
    windows(b) {
        const key = `${b.rows}x${b.cols}`;
        this._win = this._win || {};
        if (this._win[key]) return this._win[key];
        const out = [];
        const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
        for (let r = 0; r < b.rows; r++) for (let c = 0; c < b.cols; c++) for (const [dr, dc] of dirs) {
            const cells = [];
            for (let k = 0; k < 4; k++) {
                const nr = r + dr * k, nc = c + dc * k;
                if (nr < 0 || nc < 0 || nr >= b.rows || nc >= b.cols) break;
                cells.push([nr, nc]);
            }
            if (cells.length === 4) out.push(cells);
        }
        this._win[key] = out;
        return out;
    },

    winner(b) {
        for (const w of this.windows(b)) {
            const v = b.cells[w[0][0]][w[0][1]];
            if (v && w.every(([r, c]) => b.cells[r][c] === v)) return { who: v, cells: w };
        }
        return null;
    },

    isFull(b) {
        return b.cells[0].every(v => v !== 0);
    },

    moves(b) {
        const center = (b.cols - 1) / 2;
        return [...Array(b.cols).keys()].filter(c => this.canDrop(b, c)).sort((x, y) => Math.abs(x - center) - Math.abs(y - center));
    },

    evaluate(b, who) {
        const opp = 3 - who;
        const score = [0, 1, 8, 60, 0];
        let total = 0;
        for (const w of this.windows(b)) {
            let mine = 0, theirs = 0;
            for (const [r, c] of w) { const v = b.cells[r][c]; if (v === who) mine++; else if (v === opp) theirs++; }
            if (mine && theirs) continue;
            if (mine) total += score[mine]; else if (theirs) total -= score[theirs] * 1.1;
        }
        const center = Math.floor(b.cols / 2);
        for (let r = 0; r < b.rows; r++) { if (b.cells[r][center] === who) total += 3; else if (b.cells[r][center] === opp) total -= 3; }
        return total;
    },

    search(b, who, me, depth, alpha, beta, deadline) {
        const w = this.winner(b);
        if (w) return w.who === me ? 100000 + depth : -100000 - depth;
        if (this.isFull(b)) return 0;
        if (depth === 0) return this.evaluate(b, me);
        if (Date.now() > deadline) throw new Error('timeout');
        const maximizing = who === me;
        let best = maximizing ? -Infinity : Infinity;
        for (const c of this.moves(b)) {
            const v = this.search(this.drop(b, c, who), 3 - who, me, depth - 1, alpha, beta, deadline);
            if (maximizing) { best = Math.max(best, v); alpha = Math.max(alpha, v); }
            else { best = Math.min(best, v); beta = Math.min(beta, v); }
            if (beta <= alpha) break;
        }
        return best;
    },

    // Immediate wins and blocks first, then deepening search within the time budget
    getMove(b, who, maxDepth, timeMs = 800) {
        const moves = this.moves(b);
        if (!moves.length) return null;
        for (const c of moves) { const w = this.winner(this.drop(b, c, who)); if (w) return c; }
        for (const c of moves) { const w = this.winner(this.drop(b, c, 3 - who)); if (w) return c; }
        let best = moves[0];
        const deadline = Date.now() + timeMs;
        for (let depth = 1; depth <= maxDepth; depth++) {
            try {
                let bestScore = -Infinity, bestMove = best;
                for (const c of moves) {
                    const v = this.search(this.drop(b, c, who), 3 - who, who, depth - 1, -Infinity, Infinity, deadline);
                    if (v > bestScore) { bestScore = v; bestMove = c; }
                }
                best = bestMove;
            } catch (e) { break; }
        }
        return best;
    },

    getNoviceMove(b, who) {
        return this.getMove(b, who, 2, 200);
    }
};
