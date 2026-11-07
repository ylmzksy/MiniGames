/**
 * Pentago. A 6x6 board made of four 3x3 quadrants. A move places a marble and
 * then rotates one quadrant a quarter turn either way. Five in a row wins;
 * if a rotation gives both sides five, or the board fills up, it is a draw.
 * Quadrants: 0 top-left, 1 top-right, 2 bottom-left, 3 bottom-right.
 */
const PentagoEngine = {
    dirs: [[0, 1], [1, 0], [1, 1], [1, -1]],

    create() {
        return { cells: Array.from({ length: 6 }, () => Array(6).fill(0)), last: null, count: 0 };
    },

    clone(b) {
        return { cells: b.cells.map(r => [...r]), last: b.last, count: b.count };
    },

    rotate(cells, q, dir) {
        const r0 = q < 2 ? 0 : 3, c0 = q % 2 ? 3 : 0;
        const out = cells.map(r => [...r]);
        for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
            const [ni, nj] = dir === 'cw' ? [j, 2 - i] : [2 - j, i];
            out[r0 + ni][c0 + nj] = cells[r0 + i][c0 + j];
        }
        return out;
    },

    apply(b, move, who) {
        const next = this.clone(b);
        next.cells[move.r][move.c] = who;
        next.cells = this.rotate(next.cells, move.q, move.dir);
        next.last = move;
        next.count++;
        return next;
    },

    windows() {
        if (this._win) return this._win;
        const out = [];
        for (let r = 0; r < 6; r++) for (let c = 0; c < 6; c++) for (const [dr, dc] of this.dirs) {
            const cells = [];
            for (let k = 0; k < 5; k++) { const nr = r + dr * k, nc = c + dc * k; if (nr < 0 || nc < 0 || nr > 5 || nc > 5) break; cells.push([nr, nc]); }
            if (cells.length === 5) out.push(cells);
        }
        this._win = out;
        return out;
    },

    lines(b, who) {
        return this.windows().filter(w => w.every(([r, c]) => b.cells[r][c] === who));
    },

    // { who: 1|2, cells } for a win, { who: 0 } for a draw, or null
    winner(b) {
        const l1 = this.lines(b, 1), l2 = this.lines(b, 2);
        if (l1.length && l2.length) return { who: 0, cells: [...l1[0], ...l2[0]] };
        if (l1.length) return { who: 1, cells: l1[0] };
        if (l2.length) return { who: 2, cells: l2[0] };
        if (b.count >= 36) return { who: 0, cells: [] };
        return null;
    },

    moves(b) {
        const out = [];
        const center = 2.5;
        const empties = [];
        for (let r = 0; r < 6; r++) for (let c = 0; c < 6; c++) if (!b.cells[r][c]) empties.push([r, c]);
        empties.sort((a, z) => (Math.abs(a[0] - center) + Math.abs(a[1] - center)) - (Math.abs(z[0] - center) + Math.abs(z[1] - center)));
        for (const [r, c] of empties) for (let q = 0; q < 4; q++) for (const dir of ['cw', 'ccw']) out.push({ r, c, q, dir });
        return out;
    },

    evaluate(b, who) {
        const opp = 3 - who;
        const score = [0, 1, 10, 120, 2000, 100000];
        let total = 0;
        for (const w of this.windows()) {
            let mine = 0, theirs = 0;
            for (const [r, c] of w) { const v = b.cells[r][c]; if (v === who) mine++; else if (v === opp) theirs++; }
            if (mine && theirs) continue;
            if (mine) total += score[mine]; else if (theirs) total -= score[theirs] * 1.2;
        }
        return total;
    },

    search(b, who, me, depth, alpha, beta, deadline) {
        const w = this.winner(b);
        if (w) return w.who === me ? 1000000 + depth : w.who === 0 ? 0 : -1000000 - depth;
        if (depth === 0) return this.evaluate(b, me);
        if (Date.now() > deadline) throw new Error('timeout');
        const maximizing = who === me;
        let best = maximizing ? -Infinity : Infinity;
        for (const m of this.moves(b)) {
            const v = this.search(this.apply(b, m, who), 3 - who, me, depth - 1, alpha, beta, deadline);
            if (maximizing) { best = Math.max(best, v); alpha = Math.max(alpha, v); }
            else { best = Math.min(best, v); beta = Math.min(beta, v); }
            if (beta <= alpha) break;
        }
        return best;
    },

    // Immediate wins first, then deepening search within the time budget
    getMove(b, who, maxDepth, timeMs = 900) {
        const moves = this.moves(b);
        if (!moves.length) return null;
        for (const m of moves) { const w = this.winner(this.apply(b, m, who)); if (w && w.who === who) return m; }
        const deadline = Date.now() + timeMs;
        // order root moves by a one-ply evaluation so the search prunes well
        const scored = moves.map(m => ({ m, s: this.evaluate(this.apply(b, m, who), who) })).sort((a, z) => z.s - a.s);
        let best = scored[0].m;
        for (let depth = 1; depth <= maxDepth; depth++) {
            try {
                let bestScore = -Infinity, bestMove = best;
                for (const { m } of scored) {
                    const v = this.search(this.apply(b, m, who), 3 - who, who, depth - 1, -Infinity, Infinity, deadline);
                    if (v > bestScore) { bestScore = v; bestMove = m; }
                }
                best = bestMove;
            } catch (e) { break; }
        }
        return best;
    },

    getNoviceMove(b, who) {
        const moves = this.moves(b);
        for (const m of moves) { const w = this.winner(this.apply(b, m, who)); if (w && w.who === who) return m; }
        // avoid moves that hand the opponent an immediate win when a safe move exists
        const safe = moves.filter(m => { const n = this.apply(b, m, who); return !this.moves(n).some(o => { const w = this.winner(this.apply(n, o, 3 - who)); return w && w.who === 3 - who; }); });
        const pool = safe.length ? safe : moves;
        return pool[Math.floor(Math.random() * Math.min(pool.length, 24))];
    }
};
