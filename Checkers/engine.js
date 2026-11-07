/**
 * Checkers (English draughts) on a 6x6 or 8x8 board. Men move one step
 * diagonally forward and capture by jumping; captures are mandatory and a
 * piece keeps jumping while it can. A man reaching the far row becomes a
 * king, which moves and jumps in all four directions. A side with no legal
 * move loses. The player (side 0) starts at the bottom and moves up.
 * A move is { from, path: [cells...], captures: [cells...] }.
 */
const CheckersEngine = {
    create(level) {
        const n = level.size;
        const rows = level.rows;
        const board = Array.from({ length: n }, () => Array(n).fill(null));
        for (let r = 0; r < n; r++) {
            for (let c = 0; c < n; c++) {
                if ((r + c) % 2 !== 1) continue;
                if (r < rows) board[r][c] = { owner: 1, king: false };
                if (r >= n - rows) board[r][c] = { owner: 0, king: false };
            }
        }
        return { n, board, turn: 0, quiet: 0 };
    },

    clone(state) {
        return { n: state.n, board: state.board.map(row => row.map(p => p && { ...p })), turn: state.turn, quiet: state.quiet };
    },

    dirs(piece) {
        const forward = piece.owner === 0 ? -1 : 1;
        return piece.king ? [[-1, -1], [-1, 1], [1, -1], [1, 1]] : [[forward, -1], [forward, 1]];
    },

    inside(n, r, c) {
        return r >= 0 && c >= 0 && r < n && c < n;
    },

    // All jump sequences for the piece at (r, c)
    jumps(state, r, c, piece, taken = [], path = [[r, c]]) {
        const out = [];
        for (const [dr, dc] of this.dirs(piece)) {
            const mr = r + dr;
            const mc = c + dc;
            const lr = r + 2 * dr;
            const lc = c + 2 * dc;
            if (!this.inside(state.n, lr, lc)) continue;
            const mid = state.board[mr][mc];
            const landing = state.board[lr][lc];
            const midKey = `${mr},${mc}`;
            if (!mid || mid.owner === piece.owner || taken.includes(midKey)) continue;
            if (landing && !(lr === path[0][0] && lc === path[0][1])) continue;
            const promoted = !piece.king && lr === (piece.owner === 0 ? 0 : state.n - 1);
            const nextTaken = [...taken, midKey];
            const nextPath = [...path, [lr, lc]];
            const more = promoted ? [] : this.jumps(state, lr, lc, piece, nextTaken, nextPath);
            if (more.length) out.push(...more);
            else out.push({ from: path[0], path: nextPath, captures: nextTaken.map(k => k.split(',').map(Number)) });
        }
        return out;
    },

    moves(state, side = state.turn) {
        const captures = [];
        const simple = [];
        for (let r = 0; r < state.n; r++) {
            for (let c = 0; c < state.n; c++) {
                const piece = state.board[r][c];
                if (!piece || piece.owner !== side) continue;
                captures.push(...this.jumps(state, r, c, piece));
                for (const [dr, dc] of this.dirs(piece)) {
                    const nr = r + dr;
                    const nc = c + dc;
                    if (this.inside(state.n, nr, nc) && !state.board[nr][nc]) simple.push({ from: [r, c], path: [[r, c], [nr, nc]], captures: [] });
                }
            }
        }
        return captures.length ? captures : simple;
    },

    apply(state, move) {
        const next = this.clone(state);
        const [fr, fc] = move.from;
        const piece = next.board[fr][fc];
        next.board[fr][fc] = null;
        move.captures.forEach(([r, c]) => { next.board[r][c] = null; });
        const [tr, tc] = move.path[move.path.length - 1];
        const king = piece.king || tr === (piece.owner === 0 ? 0 : state.n - 1);
        next.board[tr][tc] = { owner: piece.owner, king };
        next.turn = 1 - state.turn;
        next.quiet = move.captures.length || (king && !piece.king) ? 0 : state.quiet + 1;
        return next;
    },

    // 'win' side index when the side to move has no moves, 'draw' after a long quiet spell, else null
    result(state) {
        if (!this.moves(state).length) return { winner: 1 - state.turn };
        if (state.quiet >= 50) return { winner: null };
        return null;
    },

    evaluate(state) {
        let score = 0;
        for (let r = 0; r < state.n; r++) {
            for (let c = 0; c < state.n; c++) {
                const p = state.board[r][c];
                if (!p) continue;
                const sign = p.owner === 1 ? 1 : -1;
                score += sign * (p.king ? 160 : 100);
                if (!p.king) score += sign * (p.owner === 1 ? r : state.n - 1 - r) * 2; // advancement
            }
        }
        return score;
    },

    search(state, depth, alpha, beta) {
        const res = this.result(state);
        if (res) return res.winner === null ? 0 : res.winner === 1 ? 10000 + depth : -10000 - depth;
        if (depth === 0) return this.evaluate(state);
        const maximizing = state.turn === 1;
        let best = maximizing ? -Infinity : Infinity;
        for (const move of this.moves(state)) {
            const value = this.search(this.apply(state, move), depth - 1, alpha, beta);
            if (maximizing) { best = Math.max(best, value); alpha = Math.max(alpha, value); }
            else { best = Math.min(best, value); beta = Math.min(beta, value); }
            if (beta <= alpha) break;
        }
        return best;
    },

    bestMove(state, depth) {
        const moves = this.moves(state);
        let best = [];
        let bestValue = -Infinity;
        for (const move of moves) {
            const value = this.search(this.apply(state, move), depth - 1, -Infinity, Infinity);
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
        return this.bestMove(state, depth);
    }
};
