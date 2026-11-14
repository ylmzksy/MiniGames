/**
 * Lines of Action. A piece moves in a straight line exactly as many squares as
 * there are pieces (of either color) on that whole line. It may jump over own
 * pieces, never over enemy pieces, and may land on an enemy piece to capture
 * it. You win when all your pieces form one connected group (8 directions).
 */
const LoaEngine = {
    dirs: [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1], [1, -1], [1, 1]],

    create(level) {
        const n = level.size;
        const board = Array.from({ length: n }, () => Array(n).fill(null));
        for (let i = 1; i < n - 1; i++) {
            board[0][i] = 'blue';
            board[n - 1][i] = 'blue';
            board[i][0] = 'red';
            board[i][n - 1] = 'red';
        }
        return { size: n, board, turn: 'blue', plies: 0, winner: null };
    },

    clone(state) {
        return { size: state.size, board: state.board.map(r => [...r]), turn: state.turn, plies: state.plies, winner: state.winner };
    },

    other(c) { return c === 'blue' ? 'red' : 'blue'; },

    inside(n, r, c) { return r >= 0 && c >= 0 && r < n && c < n; },

    // Number of pieces on the full line through (r, c) in direction d
    lineCount(state, r, c, [dr, dc]) {
        let count = 0;
        for (const s of [1, -1]) {
            let rr = r + dr * s, cc = c + dc * s;
            while (this.inside(state.size, rr, cc)) { if (state.board[rr][cc]) count++; rr += dr * s; cc += dc * s; }
        }
        return count + 1;
    },

    movesFrom(state, r, c) {
        const color = state.board[r][c];
        const out = [];
        for (const d of this.dirs) {
            const dist = this.lineCount(state, r, c, d);
            let ok = true;
            let rr = r, cc = c;
            for (let i = 1; i <= dist; i++) {
                rr += d[0]; cc += d[1];
                if (!this.inside(state.size, rr, cc)) { ok = false; break; }
                const occ = state.board[rr][cc];
                if (i < dist && occ && occ !== color) { ok = false; break; }
                if (i === dist && occ === color) { ok = false; break; }
            }
            if (ok) out.push({ from: [r, c], to: [rr, cc] });
        }
        return out;
    },

    moves(state, color = state.turn) {
        const out = [];
        state.board.forEach((row, r) => row.forEach((v, c) => { if (v === color) out.push(...this.movesFrom(state, r, c)); }));
        return out;
    },

    pieces(state, color) {
        const out = [];
        state.board.forEach((row, r) => row.forEach((v, c) => { if (v === color) out.push([r, c]); }));
        return out;
    },

    groups(state, color) {
        const seen = new Set();
        let groups = 0;
        for (const [r, c] of this.pieces(state, color)) {
            const key = r * state.size + c;
            if (seen.has(key)) continue;
            groups++;
            const stack = [[r, c]];
            seen.add(key);
            while (stack.length) {
                const [x, y] = stack.pop();
                for (const [dr, dc] of this.dirs) {
                    const nr = x + dr, nc = y + dc;
                    if (this.inside(state.size, nr, nc) && state.board[nr][nc] === color && !seen.has(nr * state.size + nc)) {
                        seen.add(nr * state.size + nc);
                        stack.push([nr, nc]);
                    }
                }
            }
        }
        return groups;
    },

    apply(state, move) {
        const next = this.clone(state);
        const mover = next.turn;
        next.board[move.to[0]][move.to[1]] = mover;
        next.board[move.from[0]][move.from[1]] = null;
        next.plies++;
        const moverConnected = this.groups(next, mover) <= 1;
        const otherConnected = this.groups(next, this.other(mover)) <= 1;
        if (moverConnected) next.winner = mover;
        else if (otherConnected) next.winner = this.other(mover);
        else if (next.plies >= 150) next.winner = 'draw';
        next.turn = this.other(mover);
        return next;
    },

    // From red's point of view
    evaluate(state) {
        if (state.winner === 'red') return 10000;
        if (state.winner === 'blue') return -10000;
        if (state.winner === 'draw') return 0;
        const n = state.size, mid = (n - 1) / 2;
        const side = color => {
            const ps = this.pieces(state, color);
            if (!ps.length) return -500;
            const cx = ps.reduce((s, p) => s + p[0], 0) / ps.length;
            const cy = ps.reduce((s, p) => s + p[1], 0) / ps.length;
            let central = 0, spread = 0;
            ps.forEach(([r, c]) => { central -= Math.abs(r - mid) + Math.abs(c - mid); spread -= Math.abs(r - cx) + Math.abs(c - cy); });
            return central * 2 + spread * 3 - this.groups(state, color) * 25;
        };
        return side('red') - side('blue') + 0.5 * (this.moves(state, 'red').length - this.moves(state, 'blue').length);
    },

    search(state, depth, alpha, beta, deadline) {
        if (state.winner || depth === 0) return this.evaluate(state);
        const maximizing = state.turn === 'red';
        let best = maximizing ? -Infinity : Infinity;
        for (const move of this.moves(state)) {
            if (performance.now() > deadline) break;
            const value = this.search(this.apply(state, move), depth - 1, alpha, beta, deadline);
            if (maximizing) { best = Math.max(best, value); alpha = Math.max(alpha, value); }
            else { best = Math.min(best, value); beta = Math.min(beta, value); }
            if (beta <= alpha) break;
        }
        return best;
    },

    bestMove(state, maxDepth, budgetMs) {
        const deadline = performance.now() + budgetMs;
        const moves = this.moves(state);
        let best = moves[0];
        for (let depth = 1; depth <= maxDepth; depth++) {
            let bestScore = -Infinity, bestAtDepth = null;
            for (const move of moves) {
                const next = this.apply(state, move);
                if (next.winner === 'red') return move;
                const score = this.search(next, depth - 1, -Infinity, Infinity, deadline);
                if (score > bestScore) { bestScore = score; bestAtDepth = move; }
                if (performance.now() > deadline) break;
            }
            if (performance.now() > deadline) break;
            best = bestAtDepth;
        }
        return best;
    },

    getNoviceMove(state) {
        const moves = this.moves(state);
        for (const m of moves) if (this.apply(state, m).winner === 'red') return m;
        return moves[Math.floor(Math.random() * moves.length)];
    },

    getMasterMove(state, depth) {
        return this.bestMove(state, depth, 800);
    }
};
