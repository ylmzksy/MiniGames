/**
 * Konane (Hawaiian checkers). The board starts full in a checkerboard pattern,
 * black (you, side 0) and white (AI, side 1). First you remove one of your
 * stones from the center or a corner, then the AI removes one of its stones
 * next to the gap. After that every move is a jump: a stone leaps orthogonally
 * over an adjacent enemy into the empty square beyond, removing it, and may
 * keep jumping in the same direction. Whoever cannot jump loses.
 * A move is { from, path, captures } (a removal has path [from], remove: true).
 */
const KonaneEngine = {
    BUDGET_MS: 700,

    create(level) {
        const n = level.size;
        const board = Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => (r + c) % 2 === 0 ? 0 : 1));
        return { n, board, turn: 0, phase: 'remove', removed: null };
    },

    clone(state) {
        return { n: state.n, board: state.board.map(row => [...row]), turn: state.turn, phase: state.phase, removed: state.removed };
    },

    inside(n, r, c) {
        return r >= 0 && c >= 0 && r < n && c < n;
    },

    moves(state, side = state.turn) {
        const { n, board } = state;
        const out = [];
        if (state.phase === 'remove') {
            if (side === 0) {
                const mid = n / 2;
                const spots = [[0, 0], [0, n - 1], [n - 1, 0], [n - 1, n - 1], [mid - 1, mid - 1], [mid - 1, mid], [mid, mid - 1], [mid, mid]];
                spots.forEach(([r, c]) => { if (board[r][c] === 0) out.push({ from: [r, c], path: [[r, c]], captures: [[r, c]], stepCaptures: [], remove: true }); });
            } else {
                const [gr, gc] = state.removed;
                [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dr, dc]) => {
                    const r = gr + dr;
                    const c = gc + dc;
                    if (this.inside(n, r, c) && board[r][c] === 1) out.push({ from: [r, c], path: [[r, c]], captures: [[r, c]], stepCaptures: [], remove: true });
                });
            }
            return out;
        }
        for (let r = 0; r < n; r++) {
            for (let c = 0; c < n; c++) {
                if (board[r][c] !== side) continue;
                for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                    let cr = r;
                    let cc = c;
                    const path = [[r, c]];
                    const captures = [];
                    while (true) {
                        const mr = cr + dr;
                        const mc = cc + dc;
                        const lr = cr + 2 * dr;
                        const lc = cc + 2 * dc;
                        if (!this.inside(n, lr, lc) || board[mr][mc] !== 1 - side || board[lr][lc] !== null) break;
                        path.push([lr, lc]);
                        captures.push([mr, mc]);
                        out.push({ from: [r, c], path: [...path], captures: [...captures], stepCaptures: captures.map(x => [x]) });
                        cr = lr;
                        cc = lc;
                    }
                }
            }
        }
        return out;
    },

    apply(state, move) {
        const next = this.clone(state);
        if (move.remove) {
            const [r, c] = move.from;
            next.board[r][c] = null;
            if (state.turn === 0) { next.removed = [r, c]; next.turn = 1; }
            else { next.phase = 'play'; next.turn = 0; }
            return next;
        }
        const [fr, fc] = move.from;
        const side = next.board[fr][fc];
        next.board[fr][fc] = null;
        move.captures.forEach(([r, c]) => { next.board[r][c] = null; });
        const [tr, tc] = move.path[move.path.length - 1];
        next.board[tr][tc] = side;
        next.turn = 1 - state.turn;
        return next;
    },

    result(state) {
        if (state.phase === 'remove') return null;
        if (!this.moves(state).length) return { winner: 1 - state.turn };
        return null;
    },

    // Mobility from the AI's point of view
    evaluate(state) {
        return this.moves(state, 1).length * 10 - this.moves(state, 0).length * 10;
    },

    search(state, depth, alpha, beta, deadline) {
        const res = this.result(state);
        if (res) return res.winner === 1 ? 10000 + depth : -10000 - depth;
        if (depth === 0 || Date.now() > deadline) return this.evaluate(state);
        const maximizing = state.turn === 1;
        let best = maximizing ? -Infinity : Infinity;
        for (const move of this.moves(state)) {
            const value = this.search(this.apply(state, move), depth - 1, alpha, beta, deadline);
            if (maximizing) { best = Math.max(best, value); alpha = Math.max(alpha, value); }
            else { best = Math.min(best, value); beta = Math.min(beta, value); }
            if (beta <= alpha) break;
        }
        return best;
    },

    bestMove(state, depth, deadline) {
        const moves = this.moves(state);
        let best = [];
        let bestValue = -Infinity;
        for (const move of moves) {
            const value = this.search(this.apply(state, move), depth - 1, -Infinity, Infinity, deadline);
            if (value > bestValue) { bestValue = value; best = [move]; }
            else if (value === bestValue) best.push(move);
        }
        return best.length ? best[Math.floor(Math.random() * best.length)] : null;
    },

    getNoviceMove(state) {
        const moves = this.moves(state);
        return moves.length ? moves[Math.floor(Math.random() * moves.length)] : null;
    },

    // Iterative deepening inside the time budget; the last completed depth decides
    getMasterMove(state, depth) {
        const deadline = Date.now() + this.BUDGET_MS;
        let choice = null;
        for (let d = 1; d <= depth; d++) {
            const move = this.bestMove(state, d, deadline);
            if (move) choice = move;
            if (Date.now() > deadline) break;
        }
        return choice;
    }
};
