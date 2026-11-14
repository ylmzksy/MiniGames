/**
 * Brandubh, the 7x7 tafl game. The king starts on the central throne with
 * four defenders; eight attackers surround them. Every piece moves like a
 * rook, any distance along a row or column, without jumping. Only the king
 * may stop on the throne or the four corners; other pieces may pass across
 * the empty throne. A piece is captured when the mover sandwiches it between
 * two of the mover's pieces along a row or column, or between a piece and a
 * hostile square (a corner, or the throne when it is empty). The king is
 * captured like any piece away from the throne, but on the throne or next to
 * it he must be surrounded on all four sides. The king wins by reaching a
 * corner; the attackers win by capturing him. A side with no move loses.
 * Attackers move first.
 */
const TaflEngine = {
    N: 7,
    MOVE_CAP: 200,

    isCorner(r, c) {
        return (r === 0 || r === 6) && (c === 0 || c === 6);
    },

    isThrone(r, c) {
        return r === 3 && c === 3;
    },

    create() {
        const board = Array.from({ length: 7 }, () => Array(7).fill(null));
        board[3][3] = 'K';
        [[2, 3], [4, 3], [3, 2], [3, 4]].forEach(([r, c]) => { board[r][c] = 'D'; });
        [[0, 3], [1, 3], [5, 3], [6, 3], [3, 0], [3, 1], [3, 5], [3, 6]].forEach(([r, c]) => { board[r][c] = 'A'; });
        return { board, turn: 'attackers', moveCount: 0, history: {}, kingCaptured: false };
    },

    clone(state) {
        return { ...state, board: state.board.map(row => [...row]), history: { ...state.history } };
    },

    side(piece) {
        return piece === 'A' ? 'attackers' : piece ? 'defenders' : null;
    },

    king(state) {
        for (let r = 0; r < 7; r++) for (let c = 0; c < 7; c++) if (state.board[r][c] === 'K') return [r, c];
        return null;
    },

    moves(state) {
        const out = [];
        const { board } = state;
        for (let r = 0; r < 7; r++) for (let c = 0; c < 7; c++) {
            const piece = board[r][c];
            if (!piece || this.side(piece) !== state.turn) continue;
            for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
                let nr = r + dr, nc = c + dc;
                while (nr >= 0 && nc >= 0 && nr < 7 && nc < 7 && !board[nr][nc]) {
                    const restricted = this.isCorner(nr, nc) || this.isThrone(nr, nc);
                    if (!restricted || piece === 'K') out.push({ from: [r, c], to: [nr, nc] });
                    if (this.isCorner(nr, nc) && piece !== 'K') break; // cannot pass a corner (edge anyway)
                    nr += dr; nc += dc;
                }
            }
        }
        return out;
    },

    // True when (r, c) counts as an enemy anchor for capturing a piece of `victimSide`
    hostile(state, r, c, moverSide) {
        if (r < 0 || c < 0 || r >= 7 || c >= 7) return false;
        const piece = state.board[r][c];
        if (piece) return this.side(piece) === moverSide;
        if (this.isCorner(r, c)) return true;
        if (this.isThrone(r, c)) return true; // empty throne is hostile to everyone
        return false;
    },

    apply(state, move) {
        const next = this.clone(state);
        const piece = next.board[move.from[0]][move.from[1]];
        next.board[move.from[0]][move.from[1]] = null;
        next.board[move.to[0]][move.to[1]] = piece;
        const mover = state.turn;
        const [r, c] = move.to;
        for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
            const vr = r + dr, vc = c + dc;
            if (vr < 0 || vc < 0 || vr >= 7 || vc >= 7) continue;
            const victim = next.board[vr][vc];
            if (!victim || this.side(victim) === mover) continue;
            if (victim === 'K') {
                const nearThrone = this.isThrone(vr, vc) || (Math.abs(vr - 3) + Math.abs(vc - 3) === 1);
                const sides = [[-1, 0], [1, 0], [0, -1], [0, 1]].filter(([ar, ac]) => this.hostile(next, vr + ar, vc + ac, mover)).length;
                const captured = nearThrone ? sides === 4 : this.hostile(next, vr + dr, vc + dc, mover);
                if (captured) { next.board[vr][vc] = null; next.kingCaptured = true; }
            } else if (this.hostile(next, vr + dr, vc + dc, mover)) {
                next.board[vr][vc] = null;
            }
        }
        next.turn = mover === 'attackers' ? 'defenders' : 'attackers';
        next.moveCount++;
        const key = next.board.map(row => row.map(v => v || '.').join('')).join('') + next.turn;
        next.history[key] = (next.history[key] || 0) + 1;
        next.repeated = next.history[key] >= 3;
        return next;
    },

    winner(state) {
        if (state.kingCaptured) return 'attackers';
        const k = this.king(state);
        if (k && this.isCorner(k[0], k[1])) return 'defenders';
        if (!this.moves(state).length) return state.turn === 'attackers' ? 'defenders' : 'attackers';
        if (state.repeated || state.moveCount >= this.MOVE_CAP) return 'draw';
        return null;
    },

    // Position value from the defenders' point of view
    evaluate(state) {
        const w = this.winner(state);
        if (w === 'defenders') return 10000;
        if (w === 'attackers') return -10000;
        if (w === 'draw') return 0;
        let defenders = 0, attackers = 0;
        state.board.forEach(row => row.forEach(v => { if (v === 'D') defenders++; if (v === 'A') attackers++; }));
        const [kr, kc] = this.king(state);
        const cornerDist = Math.min(kr + kc, kr + (6 - kc), (6 - kr) + kc, (6 - kr) + (6 - kc));
        const probe = this.clone(state);
        probe.turn = 'defenders';
        const kingMoves = this.moves(probe).filter(m => m.from[0] === kr && m.from[1] === kc);
        const cornerReach = kingMoves.some(m => this.isCorner(m.to[0], m.to[1]));
        let around = 0;
        [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(([dr, dc]) => { if (state.board[kr + dr]?.[kc + dc] === 'A') around++; });
        return defenders * 30 - attackers * 20 - cornerDist * 8 + kingMoves.length * 3 + (cornerReach ? 60 : 0) - around * 25;
    },

    search(state, depth, alpha, beta, deadline) {
        const w = this.winner(state);
        if (w || depth === 0 || Date.now() > deadline) return this.evaluate(state) + (w === 'defenders' ? depth : w === 'attackers' ? -depth : 0);
        const max = state.turn === 'defenders';
        const moves = this.moves(state);
        let best = max ? -Infinity : Infinity;
        for (const m of moves) {
            const v = this.search(this.apply(state, m), depth - 1, alpha, beta, deadline);
            if (max) { best = Math.max(best, v); alpha = Math.max(alpha, v); }
            else { best = Math.min(best, v); beta = Math.min(beta, v); }
            if (beta <= alpha) break;
        }
        return best;
    },

    getMasterMove(state, maxDepth, budgetMs = 800) {
        const moves = this.moves(state);
        if (!moves.length) return null;
        const deadline = Date.now() + budgetMs;
        const max = state.turn === 'defenders';
        let best = moves[0];
        for (let depth = 1; depth <= maxDepth; depth++) {
            let bestVal = max ? -Infinity : Infinity;
            let bestMove = null;
            for (const m of moves) {
                const v = this.search(this.apply(state, m), depth - 1, -Infinity, Infinity, deadline);
                if ((max && v > bestVal) || (!max && v < bestVal)) { bestVal = v; bestMove = m; }
            }
            if (Date.now() > deadline && depth > 1) break;
            best = bestMove;
        }
        return best;
    },

    getNoviceMove(state) {
        const moves = this.moves(state);
        if (!moves.length) return null;
        const winning = moves.filter(m => this.winner(this.apply(state, m)) === state.turn);
        if (winning.length) return winning[0];
        const capturing = moves.filter(m => this.count(this.apply(state, m)) < this.count(state));
        if (capturing.length && Math.random() < 0.6) return capturing[Math.floor(Math.random() * capturing.length)];
        return moves[Math.floor(Math.random() * moves.length)];
    },

    count(state) {
        return state.board.flat().filter(Boolean).length;
    }
};
