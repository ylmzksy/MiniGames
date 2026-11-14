/**
 * Teeko. 5x5 board, four pieces each. First both sides place their pieces,
 * then a move slides one piece one step in any of eight directions. Win with
 * four in a row (any direction) or four forming a 2x2 square.
 */
const TeekoEngine = {
    dirs: [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1], [1, -1], [1, 1]],
    quads: null,

    buildQuads() {
        if (this.quads) return this.quads;
        const q = [];
        for (let r = 0; r < 5; r++) for (let c = 0; c < 2; c++) q.push([0, 1, 2, 3].map(i => [r, c + i]));
        for (let c = 0; c < 5; c++) for (let r = 0; r < 2; r++) q.push([0, 1, 2, 3].map(i => [r + i, c]));
        for (let r = 0; r < 2; r++) for (let c = 0; c < 2; c++) q.push([0, 1, 2, 3].map(i => [r + i, c + i]));
        for (let r = 0; r < 2; r++) for (let c = 3; c < 5; c++) q.push([0, 1, 2, 3].map(i => [r + i, c - i]));
        for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) q.push([[r, c], [r, c + 1], [r + 1, c], [r + 1, c + 1]]);
        this.quads = q;
        return q;
    },

    create() {
        return { board: Array.from({ length: 5 }, () => Array(5).fill(null)), hands: { blue: 4, red: 4 }, turn: 'blue', plies: 0, winner: null };
    },

    clone(s) {
        return { board: s.board.map(r => [...r]), hands: { ...s.hands }, turn: s.turn, plies: s.plies, winner: s.winner };
    },

    other(c) { return c === 'blue' ? 'red' : 'blue'; },

    placing(s) { return s.hands[s.turn] > 0; },

    moves(s) {
        const out = [];
        if (this.placing(s)) {
            s.board.forEach((row, r) => row.forEach((v, c) => { if (!v) out.push({ to: [r, c] }); }));
            return out;
        }
        s.board.forEach((row, r) => row.forEach((v, c) => {
            if (v !== s.turn) return;
            for (const [dr, dc] of this.dirs) {
                const nr = r + dr, nc = c + dc;
                if (nr >= 0 && nc >= 0 && nr < 5 && nc < 5 && !s.board[nr][nc]) out.push({ from: [r, c], to: [nr, nc] });
            }
        }));
        return out;
    },

    movesFrom(s, r, c) { return this.moves(s).filter(m => m.from && m.from[0] === r && m.from[1] === c); },

    winningQuad(s, color) {
        return this.buildQuads().find(q => q.every(([r, c]) => s.board[r][c] === color)) || null;
    },

    apply(s, move) {
        const next = this.clone(s);
        const mover = s.turn;
        if (move.from) next.board[move.from[0]][move.from[1]] = null;
        else next.hands[mover]--;
        next.board[move.to[0]][move.to[1]] = mover;
        next.plies++;
        if (this.winningQuad(next, mover)) next.winner = mover;
        else if (next.plies >= 200) next.winner = 'draw';
        next.turn = this.other(mover);
        return next;
    },

    evaluate(s) {
        if (s.winner === 'red') return 100000;
        if (s.winner === 'blue') return -100000;
        if (s.winner === 'draw') return 0;
        const table = [0, 1, 8, 60, 100000];
        let score = 0;
        for (const q of this.buildQuads()) {
            let red = 0, blue = 0;
            for (const [r, c] of q) { if (s.board[r][c] === 'red') red++; else if (s.board[r][c] === 'blue') blue++; }
            if (red && !blue) score += table[red];
            else if (blue && !red) score -= table[blue];
        }
        return score;
    },

    search(s, depth, alpha, beta, deadline) {
        if (s.winner || depth === 0) return this.evaluate(s);
        const maximizing = s.turn === 'red';
        let best = maximizing ? -Infinity : Infinity;
        for (const move of this.moves(s)) {
            if (performance.now() > deadline) break;
            const value = this.search(this.apply(s, move), depth - 1, alpha, beta, deadline);
            if (maximizing) { best = Math.max(best, value); alpha = Math.max(alpha, value); }
            else { best = Math.min(best, value); beta = Math.min(beta, value); }
            if (beta <= alpha) break;
        }
        return best;
    },

    bestMove(s, maxDepth, budgetMs) {
        const deadline = performance.now() + budgetMs;
        const moves = this.moves(s);
        let best = moves[Math.floor(Math.random() * moves.length)];
        for (let depth = 1; depth <= maxDepth; depth++) {
            let bestScore = -Infinity, bestAtDepth = null;
            for (const move of moves) {
                const next = this.apply(s, move);
                if (next.winner === 'red') return move;
                const score = this.search(next, depth - 1, -Infinity, Infinity, deadline) + Math.random() * 0.1;
                if (score > bestScore) { bestScore = score; bestAtDepth = move; }
                if (performance.now() > deadline) break;
            }
            if (performance.now() > deadline) break;
            best = bestAtDepth;
        }
        return best;
    },

    getNoviceMove(s) { return this.bestMove(s, 1, 200); },
    getMasterMove(s, depth) { return this.bestMove(s, depth, 800); }
};
