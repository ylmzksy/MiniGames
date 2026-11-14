/**
 * Dao. 4x4 board, four pieces each on opposite diagonals. A piece slides in
 * a straight line (eight directions) as far as it can go. Win with four in a
 * row or column, a 2x2 square, or your four pieces on the four corners. If
 * you trap an enemy piece in a corner with three of yours, the trapped side
 * wins instead.
 */
const DaoEngine = {
    dirs: [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1], [1, -1], [1, 1]],
    patterns: null,

    buildPatterns() {
        if (this.patterns) return this.patterns;
        const p = [];
        for (let r = 0; r < 4; r++) p.push([0, 1, 2, 3].map(c => [r, c]));
        for (let c = 0; c < 4; c++) p.push([0, 1, 2, 3].map(r => [r, c]));
        for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) p.push([[r, c], [r, c + 1], [r + 1, c], [r + 1, c + 1]]);
        p.push([[0, 0], [0, 3], [3, 0], [3, 3]]);
        this.patterns = p;
        return p;
    },

    create() {
        const board = Array.from({ length: 4 }, () => Array(4).fill(null));
        for (let i = 0; i < 4; i++) { board[i][i] = 'blue'; board[i][3 - i] = 'red'; }
        return { board, turn: 'blue', plies: 0, winner: null };
    },

    clone(s) { return { board: s.board.map(r => [...r]), turn: s.turn, plies: s.plies, winner: s.winner }; },
    other(c) { return c === 'blue' ? 'red' : 'blue'; },

    movesFrom(s, r, c) {
        const out = [];
        for (const [dr, dc] of this.dirs) {
            let rr = r, cc = c;
            while (rr + dr >= 0 && cc + dc >= 0 && rr + dr < 4 && cc + dc < 4 && !s.board[rr + dr][cc + dc]) { rr += dr; cc += dc; }
            if (rr !== r || cc !== c) out.push({ from: [r, c], to: [rr, cc] });
        }
        return out;
    },

    moves(s) {
        const out = [];
        s.board.forEach((row, r) => row.forEach((v, c) => { if (v === s.turn) out.push(...this.movesFrom(s, r, c)); }));
        return out;
    },

    winningPattern(s, color) {
        return this.buildPatterns().find(p => p.every(([r, c]) => s.board[r][c] === color)) || null;
    },

    // A piece of `color` in a corner surrounded by three enemy pieces
    trapped(s, color) {
        const corners = [[0, 0, [[0, 1], [1, 0], [1, 1]]], [0, 3, [[0, 2], [1, 3], [1, 2]]], [3, 0, [[2, 0], [3, 1], [2, 1]]], [3, 3, [[2, 3], [3, 2], [2, 2]]]];
        const enemy = this.other(color);
        return corners.some(([r, c, around]) => s.board[r][c] === color && around.every(([ar, ac]) => s.board[ar][ac] === enemy));
    },

    apply(s, move) {
        const next = this.clone(s);
        const mover = s.turn;
        next.board[move.to[0]][move.to[1]] = mover;
        next.board[move.from[0]][move.from[1]] = null;
        next.plies++;
        const enemy = this.other(mover);
        if (this.winningPattern(next, mover)) next.winner = mover;
        else if (this.trapped(next, enemy)) next.winner = enemy; // trapping the enemy loses
        else if (next.plies >= 100) next.winner = 'draw';
        next.turn = enemy;
        return next;
    },

    evaluate(s) {
        if (s.winner === 'red') return 10000;
        if (s.winner === 'blue') return -10000;
        if (s.winner === 'draw') return 0;
        const table = [0, 1, 6, 40, 10000];
        let score = 0;
        for (const p of this.buildPatterns()) {
            let red = 0, blue = 0;
            for (const [r, c] of p) { if (s.board[r][c] === 'red') red++; else if (s.board[r][c] === 'blue') blue++; }
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
