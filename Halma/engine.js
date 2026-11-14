/**
 * Halma on a square board. Each side starts in a corner triangle: you (side 0)
 * bottom left, the AI (side 1) top right. A move is one step in any of the
 * eight directions, or a chain of jumps over any pieces (own or enemy) onto
 * empty squares. Nothing is captured. The first side to fill the opposite
 * camp with all its pieces wins; 200 moves without a result is a draw.
 * A move is { from, path, captures: [] }.
 */
const HalmaEngine = {
    BUDGET_MS: 700,
    DIRS: [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]],

    create(level) {
        const n = level.size;
        const depth = level.camp; // camp = all cells with distance sum <= camp - 1 from the corner
        const board = Array.from({ length: n }, () => Array(n).fill(null));
        for (let r = 0; r < n; r++) {
            for (let c = 0; c < n; c++) {
                if ((n - 1 - r) + c < depth) board[r][c] = 0;
                if (r + (n - 1 - c) < depth) board[r][c] = 1;
            }
        }
        return { n, camp: depth, board, turn: 0, moveCount: 0 };
    },

    clone(state) {
        return { n: state.n, camp: state.camp, board: state.board.map(row => [...row]), turn: state.turn, moveCount: state.moveCount };
    },

    inside(n, r, c) {
        return r >= 0 && c >= 0 && r < n && c < n;
    },

    // True when (r, c) lies in the camp that `side` must reach
    inTarget(state, side, r, c) {
        const n = state.n;
        return side === 0 ? r + (n - 1 - c) < state.camp : (n - 1 - r) + c < state.camp;
    },

    moves(state, side = state.turn) {
        const out = [];
        const { n, board } = state;
        for (let r = 0; r < n; r++) {
            for (let c = 0; c < n; c++) {
                if (board[r][c] !== side) continue;
                for (const [dr, dc] of this.DIRS) {
                    const nr = r + dr;
                    const nc = c + dc;
                    if (this.inside(n, nr, nc) && board[nr][nc] === null) out.push({ from: [r, c], path: [[r, c], [nr, nc]], captures: [], stepCaptures: [[]] });
                }
                // chains of jumps, breadth first, remembering the path to each landing
                const seen = new Map([[`${r},${c}`, [[r, c]]]]);
                const queue = [[r, c]];
                while (queue.length) {
                    const [cr, cc] = queue.shift();
                    for (const [dr, dc] of this.DIRS) {
                        const mr = cr + dr;
                        const mc = cc + dc;
                        const lr = cr + 2 * dr;
                        const lc = cc + 2 * dc;
                        if (!this.inside(n, lr, lc) || board[mr][mc] === null || board[lr][lc] !== null) continue;
                        const key = `${lr},${lc}`;
                        if (seen.has(key)) continue;
                        const path = [...seen.get(`${cr},${cc}`), [lr, lc]];
                        seen.set(key, path);
                        queue.push([lr, lc]);
                        out.push({ from: [r, c], path, captures: [], stepCaptures: path.slice(1).map(() => []) });
                    }
                }
            }
        }
        return out;
    },

    apply(state, move) {
        const next = this.clone(state);
        const [fr, fc] = move.from;
        const side = next.board[fr][fc];
        next.board[fr][fc] = null;
        const [tr, tc] = move.path[move.path.length - 1];
        next.board[tr][tc] = side;
        next.turn = 1 - state.turn;
        next.moveCount = state.moveCount + 1;
        return next;
    },

    finished(state, side) {
        for (let r = 0; r < state.n; r++) {
            for (let c = 0; c < state.n; c++) {
                if (state.board[r][c] === side && !this.inTarget(state, side, r, c)) return false;
            }
        }
        return true;
    },

    result(state) {
        if (this.finished(state, 0)) return { winner: 0 };
        if (this.finished(state, 1)) return { winner: 1 };
        if (!this.moves(state).length) return { winner: 1 - state.turn };
        if (state.moveCount >= 200) return { winner: null };
        return null;
    },

    // Sum of each side's distances to its target corner; the AI wants its own sum small
    distanceSum(state, side) {
        const n = state.n;
        let sum = 0;
        for (let r = 0; r < n; r++) {
            for (let c = 0; c < n; c++) {
                if (state.board[r][c] !== side) continue;
                sum += side === 0 ? Math.max(r, n - 1 - c) : Math.max(n - 1 - r, c);
            }
        }
        return sum;
    },

    evaluate(state) {
        return (this.distanceSum(state, 0) - this.distanceSum(state, 1)) * 10;
    },

    search(state, depth, alpha, beta, deadline) {
        const res = this.result(state);
        if (res) return res.winner === null ? 0 : res.winner === 1 ? 10000 + depth : -10000 - depth;
        if (depth === 0 || Date.now() > deadline) return this.evaluate(state);
        const maximizing = state.turn === 1;
        let best = maximizing ? -Infinity : Infinity;
        // try the most advancing moves first
        const moves = this.moves(state);
        const gain = m => { const [fr, fc] = m.from; const [tr, tc] = m.path[m.path.length - 1]; const s = state.turn; const n = state.n;
            const d = (r, c) => s === 0 ? Math.max(r, n - 1 - c) : Math.max(n - 1 - r, c); return d(fr, fc) - d(tr, tc); };
        moves.sort((a, b) => gain(b) - gain(a));
        for (const move of moves.slice(0, 24)) {
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
        // prefers moves that make progress, with some randomness
        const moves = this.moves(state);
        if (!moves.length) return null;
        const scored = moves.map(m => ({ m, v: this.evaluate(this.apply(state, m)) + Math.random() * 15 }));
        scored.sort((a, b) => b.v - a.v);
        return scored[0].m;
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
