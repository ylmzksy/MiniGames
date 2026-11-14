/**
 * Alquerque. A 5x5 board of points joined by orthogonal lines and by diagonals
 * through every other point. Each side has twelve pieces; the center is empty.
 * A piece steps along a line to an empty neighbor, or jumps an adjacent enemy
 * along a line into the empty point beyond, taking it; it may keep jumping.
 * Captures are mandatory. A side with no pieces or no moves loses; forty
 * half-moves without a capture is a draw. You are side 0 at the bottom.
 * A move is { from, path, captures }.
 */
const AlquerqueEngine = {
    BUDGET_MS: 700,
    N: 5,
    ORTHO: [[1, 0], [-1, 0], [0, 1], [0, -1]],
    DIAG: [[1, 1], [1, -1], [-1, 1], [-1, -1]],

    create() {
        const n = this.N;
        const board = Array.from({ length: n }, () => Array(n).fill(null));
        for (let c = 0; c < n; c++) { board[0][c] = 1; board[1][c] = 1; board[3][c] = 0; board[4][c] = 0; }
        board[2][0] = 1; board[2][1] = 1; board[2][3] = 0; board[2][4] = 0;
        return { n, board, turn: 0, quiet: 0 };
    },

    clone(state) {
        return { n: state.n, board: state.board.map(row => [...row]), turn: state.turn, quiet: state.quiet };
    },

    inside(n, r, c) {
        return r >= 0 && c >= 0 && r < n && c < n;
    },

    // Directions with a line from point (r, c)
    dirs(r, c) {
        return (r + c) % 2 === 0 ? [...this.ORTHO, ...this.DIAG] : this.ORTHO;
    },

    jumps(state, r, c, side, taken, path) {
        const out = [];
        for (const [dr, dc] of this.dirs(r, c)) {
            const mr = r + dr;
            const mc = c + dc;
            const lr = r + 2 * dr;
            const lc = c + 2 * dc;
            if (!this.inside(state.n, lr, lc)) continue;
            const key = `${mr},${mc}`;
            if (state.board[mr][mc] !== 1 - side || taken.includes(key)) continue;
            const landingFree = state.board[lr][lc] === null || (lr === path[0][0] && lc === path[0][1]);
            if (!landingFree) continue;
            const nextTaken = [...taken, key];
            const nextPath = [...path, [lr, lc]];
            out.push({ from: path[0], path: nextPath, captures: nextTaken.map(k => k.split(',').map(Number)), stepCaptures: nextTaken.map(k => [k.split(',').map(Number)]) });
            out.push(...this.jumps(state, lr, lc, side, nextTaken, nextPath));
        }
        return out;
    },

    moves(state, side = state.turn) {
        const captures = [];
        const steps = [];
        for (let r = 0; r < state.n; r++) {
            for (let c = 0; c < state.n; c++) {
                if (state.board[r][c] !== side) continue;
                captures.push(...this.jumps(state, r, c, side, [], [[r, c]]));
                for (const [dr, dc] of this.dirs(r, c)) {
                    const nr = r + dr;
                    const nc = c + dc;
                    if (this.inside(state.n, nr, nc) && state.board[nr][nc] === null) steps.push({ from: [r, c], path: [[r, c], [nr, nc]], captures: [], stepCaptures: [[]] });
                }
            }
        }
        return captures.length ? captures : steps;
    },

    apply(state, move) {
        const next = this.clone(state);
        const [fr, fc] = move.from;
        const side = next.board[fr][fc];
        next.board[fr][fc] = null;
        move.captures.forEach(([r, c]) => { next.board[r][c] = null; });
        const [tr, tc] = move.path[move.path.length - 1];
        next.board[tr][tc] = side;
        next.turn = 1 - state.turn;
        next.quiet = move.captures.length ? 0 : state.quiet + 1;
        return next;
    },

    count(state, side) {
        return state.board.flat().filter(v => v === side).length;
    },

    result(state) {
        if (!this.count(state, state.turn) || !this.moves(state).length) return { winner: 1 - state.turn };
        if (state.quiet >= 40) return { winner: null };
        return null;
    },

    evaluate(state) {
        return (this.count(state, 1) - this.count(state, 0)) * 100 + (this.moves(state, 1).length - this.moves(state, 0).length) * 2;
    },

    search(state, depth, alpha, beta, deadline) {
        const res = this.result(state);
        if (res) return res.winner === null ? 0 : res.winner === 1 ? 10000 + depth : -10000 - depth;
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
        let best = [];
        let bestValue = -Infinity;
        for (const move of this.moves(state)) {
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
