/**
 * Dots and Boxes. Players take turns drawing one edge between neighboring
 * dots. Completing the fourth side of a box claims it and grants another
 * move. Most boxes wins. Edges: h[r][c] above box row r (r = 0..rows),
 * v[r][c] left of box column c (c = 0..cols).
 */
const DotsEngine = {
    create(level) {
        const { rows, cols } = level;
        return {
            rows, cols,
            h: Array.from({ length: rows + 1 }, () => Array(cols).fill(false)),
            v: Array.from({ length: rows }, () => Array(cols + 1).fill(false)),
            owner: Array.from({ length: rows }, () => Array(cols).fill(null)),
            turn: 0, scores: [0, 0]
        };
    },

    clone(s) {
        return { rows: s.rows, cols: s.cols, h: s.h.map(r => [...r]), v: s.v.map(r => [...r]), owner: s.owner.map(r => [...r]), turn: s.turn, scores: [...s.scores] };
    },

    edges(s) {
        const out = [];
        s.h.forEach((row, r) => row.forEach((d, c) => { if (!d) out.push({ t: 'h', r, c }); }));
        s.v.forEach((row, r) => row.forEach((d, c) => { if (!d) out.push({ t: 'v', r, c }); }));
        return out;
    },

    sides(s, r, c) {
        return (s.h[r][c] ? 1 : 0) + (s.h[r + 1][c] ? 1 : 0) + (s.v[r][c] ? 1 : 0) + (s.v[r][c + 1] ? 1 : 0);
    },

    // Boxes touching an edge
    boxesOf(s, e) {
        const out = [];
        if (e.t === 'h') { if (e.r > 0) out.push([e.r - 1, e.c]); if (e.r < s.rows) out.push([e.r, e.c]); }
        else { if (e.c > 0) out.push([e.r, e.c - 1]); if (e.c < s.cols) out.push([e.r, e.c]); }
        return out;
    },

    isDrawn(s, e) {
        return e.t === 'h' ? s.h[e.r][e.c] : s.v[e.r][e.c];
    },

    // Draws the edge; returns the number of boxes claimed (the mover goes again if > 0)
    apply(s, e) {
        if (e.t === 'h') s.h[e.r][e.c] = true; else s.v[e.r][e.c] = true;
        let claimed = 0;
        this.boxesOf(s, e).forEach(([r, c]) => {
            if (this.sides(s, r, c) === 4 && s.owner[r][c] === null) { s.owner[r][c] = s.turn; s.scores[s.turn]++; claimed++; }
        });
        if (!claimed) s.turn = 1 - s.turn;
        return claimed;
    },

    isOver(s) {
        return s.scores[0] + s.scores[1] === s.rows * s.cols;
    },

    completes(s, e) {
        return this.boxesOf(s, e).some(([r, c]) => this.sides(s, r, c) === 3);
    },

    // Safe edges do not hand the opponent a box (no box ends up with three sides)
    isSafe(s, e) {
        return this.boxesOf(s, e).every(([r, c]) => this.sides(s, r, c) !== 2);
    },

    getNoviceMove(s) {
        const all = this.edges(s);
        const free = all.filter(e => this.completes(s, e));
        if (free.length) return free[0];
        const safe = all.filter(e => this.isSafe(s, e));
        const pool = safe.length ? safe : all;
        return pool[Math.floor(Math.random() * pool.length)];
    },

    // Evaluation from the AI's (player 1) view: box difference plus boxes the mover can take now
    evaluate(s) {
        let diff = s.scores[1] - s.scores[0];
        const takeable = this.edges(s).filter(e => this.completes(s, e)).length;
        diff += (s.turn === 1 ? 1 : -1) * Math.min(takeable, 2) * 0.5;
        return diff;
    },

    search(s, depth, alpha, beta, deadline) {
        if (this.isOver(s) || depth === 0 || Date.now() > deadline) return this.evaluate(s);
        const moves = this.orderedMoves(s);
        const maximizing = s.turn === 1;
        let best = maximizing ? -Infinity : Infinity;
        for (const e of moves) {
            const next = this.clone(s);
            const claimed = this.apply(next, e);
            // an extra move keeps the depth: chains should be followed to their end
            const value = this.search(next, claimed ? depth : depth - 1, alpha, beta, deadline);
            if (maximizing) { best = Math.max(best, value); alpha = Math.max(alpha, value); }
            else { best = Math.min(best, value); beta = Math.min(beta, value); }
            if (beta <= alpha) break;
        }
        return best;
    },

    orderedMoves(s) {
        const all = this.edges(s);
        const score = e => (this.completes(s, e) ? 2 : this.isSafe(s, e) ? 1 : 0);
        return all.sort((a, b) => score(b) - score(a));
    },

    getMasterMove(s) {
        const moves = this.orderedMoves(s);
        const remaining = moves.length;
        const depth = remaining <= 10 ? remaining : remaining <= 24 ? 5 : 4;
        const deadline = Date.now() + 700;
        let best = null;
        let alpha = -Infinity;
        for (const e of moves) {
            const next = this.clone(s);
            const claimed = this.apply(next, e);
            const value = this.search(next, claimed ? depth : depth - 1, alpha, Infinity, deadline);
            if (!best || value > best.value) best = { e, value };
            alpha = Math.max(alpha, value);
        }
        return best.e;
    }
};
