/**
 * Gomoku. Stones are placed on the intersections of a square board; five or
 * more in a row (any direction) wins. Player 1 is you (black), 2 the AI (white).
 * The AI searches candidate cells near existing stones with alpha-beta and an
 * evaluation that scores every window of five.
 */
const GomokuEngine = {
    dirs: [[0, 1], [1, 0], [1, 1], [1, -1]],

    create(size) {
        return { size, cells: Array.from({ length: size }, () => Array(size).fill(0)), last: null, count: 0 };
    },

    clone(b) {
        return { size: b.size, cells: b.cells.map(r => [...r]), last: b.last, count: b.count };
    },

    place(b, r, c, who) {
        const next = this.clone(b);
        next.cells[r][c] = who;
        next.last = [r, c];
        next.count++;
        return next;
    },

    // The winning line through (r, c), if any
    lineThrough(b, r, c) {
        const who = b.cells[r][c];
        if (!who) return null;
        for (const [dr, dc] of this.dirs) {
            const cells = [[r, c]];
            for (const s of [1, -1]) {
                let nr = r + dr * s, nc = c + dc * s;
                while (nr >= 0 && nc >= 0 && nr < b.size && nc < b.size && b.cells[nr][nc] === who) { cells.push([nr, nc]); nr += dr * s; nc += dc * s; }
            }
            if (cells.length >= 5) return { who, cells };
        }
        return null;
    },

    winner(b) {
        if (b.last) return this.lineThrough(b, ...b.last);
        for (let r = 0; r < b.size; r++) for (let c = 0; c < b.size; c++) { const w = this.lineThrough(b, r, c); if (w) return w; }
        return null;
    },

    isFull(b) {
        return b.count >= b.size * b.size;
    },

    // Empty cells within two steps of a stone (the center when the board is empty)
    candidates(b) {
        if (b.count === 0) { const m = Math.floor(b.size / 2); return [[m, m]]; }
        const set = new Set();
        for (let r = 0; r < b.size; r++) for (let c = 0; c < b.size; c++) {
            if (!b.cells[r][c]) continue;
            for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) {
                const nr = r + dr, nc = c + dc;
                if (nr >= 0 && nc >= 0 && nr < b.size && nc < b.size && !b.cells[nr][nc]) set.add(nr * b.size + nc);
            }
        }
        return [...set].map(k => [Math.floor(k / b.size), k % b.size]);
    },

    windows(size) {
        this._win = this._win || {};
        if (this._win[size]) return this._win[size];
        const out = [];
        for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) for (const [dr, dc] of this.dirs) {
            const cells = [];
            for (let k = 0; k < 5; k++) { const nr = r + dr * k, nc = c + dc * k; if (nr < 0 || nc < 0 || nr >= size || nc >= size) break; cells.push([nr, nc]); }
            if (cells.length === 5) out.push(cells);
        }
        this._win[size] = out;
        return out;
    },

    evaluate(b, who) {
        const opp = 3 - who;
        const score = [0, 1, 12, 150, 2500, 1000000];
        let total = 0;
        for (const w of this.windows(b.size)) {
            let mine = 0, theirs = 0;
            for (const [r, c] of w) { const v = b.cells[r][c]; if (v === who) mine++; else if (v === opp) theirs++; }
            if (mine && theirs) continue;
            if (mine) total += score[mine]; else if (theirs) total -= score[theirs] * 1.2;
        }
        return total;
    },

    // Cells where `who` completes five
    winningCells(b, who) {
        return this.candidates(b).filter(([r, c]) => { b.cells[r][c] = who; const w = this.lineThrough(b, r, c); b.cells[r][c] = 0; return !!w; });
    },

    orderedCandidates(b, who) {
        return this.candidates(b)
            .map(([r, c]) => { const n = this.place(b, r, c, who); return { r, c, s: this.evaluate(n, who) }; })
            .sort((a, b2) => b2.s - a.s)
            .slice(0, 12)
            .map(({ r, c }) => [r, c]);
    },

    search(b, who, me, depth, alpha, beta, deadline) {
        const w = this.winner(b);
        if (w) return w.who === me ? 10000000 + depth : -10000000 - depth;
        if (this.isFull(b)) return 0;
        if (depth === 0) return this.evaluate(b, me);
        if (Date.now() > deadline) throw new Error('timeout');
        const maximizing = who === me;
        let best = maximizing ? -Infinity : Infinity;
        for (const [r, c] of this.orderedCandidates(b, who)) {
            const v = this.search(this.place(b, r, c, who), 3 - who, me, depth - 1, alpha, beta, deadline);
            if (maximizing) { best = Math.max(best, v); alpha = Math.max(alpha, v); }
            else { best = Math.min(best, v); beta = Math.min(beta, v); }
            if (beta <= alpha) break;
        }
        return best;
    },

    // Forced moves first: win, block a four, block a double threat; then deepening search
    getMove(b, who, maxDepth, timeMs = 800) {
        const opp = 3 - who;
        const mine = this.winningCells(b, who);
        if (mine.length) return mine[0];
        const theirs = this.winningCells(b, opp);
        if (theirs.length) return theirs[0];
        // block cells that would give the opponent two ways to win (an open four next turn)
        for (const [r, c] of this.candidates(b)) {
            const n = this.place(b, r, c, opp);
            if (this.winningCells(n, opp).length >= 2) {
                // prefer taking that cell unless we can make our own threat
                const ours = this.candidates(b).find(([mr, mc]) => this.winningCells(this.place(b, mr, mc, who), who).length >= 2);
                return ours || [r, c];
            }
        }
        const deadline = Date.now() + timeMs;
        const cands = this.orderedCandidates(b, who);
        let best = cands[0];
        for (let depth = 1; depth <= maxDepth; depth++) {
            try {
                let bestScore = -Infinity, bestMove = best;
                for (const [r, c] of cands) {
                    const v = this.search(this.place(b, r, c, who), opp, who, depth - 1, -Infinity, Infinity, deadline);
                    if (v > bestScore) { bestScore = v; bestMove = [r, c]; }
                }
                best = bestMove;
            } catch (e) { break; }
        }
        return best;
    },

    getNoviceMove(b, who) {
        const mine = this.winningCells(b, who);
        if (mine.length) return mine[0];
        const theirs = this.winningCells(b, 3 - who);
        if (theirs.length) return theirs[0];
        const cands = this.orderedCandidates(b, who).slice(0, 4);
        return cands[Math.floor(Math.random() * cands.length)];
    }
};
