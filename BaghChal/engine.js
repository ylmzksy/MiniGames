/**
 * Bagh-Chal. A 5x5 board of points joined orthogonally, and diagonally through
 * the points whose row + column is even. Four tigers start in the corners.
 * The goat player first places twenty goats one per turn, then moves goats one
 * step along a line. A tiger moves one step along a line or jumps over an
 * adjacent goat along a line into the empty point beyond, capturing it.
 * Tigers win by capturing five goats; goats win by leaving every tiger
 * without a move. Goats go first.
 */
const BaghChalEngine = {
    MOVE_CAP: 300,

    valid(r, c) {
        return r >= 0 && c >= 0 && r < 5 && c < 5;
    },

    dirs(r, c) {
        const out = [[-1, 0], [1, 0], [0, -1], [0, 1]];
        if ((r + c) % 2 === 0) out.push([-1, -1], [-1, 1], [1, -1], [1, 1]);
        return out;
    },

    create() {
        const board = Array.from({ length: 5 }, () => Array(5).fill(null));
        [[0, 0], [0, 4], [4, 0], [4, 4]].forEach(([r, c]) => { board[r][c] = 'T'; });
        return { board, turn: 'goats', toPlace: 20, captured: 0, moveCount: 0 };
    },

    clone(state) {
        return { ...state, board: state.board.map(row => [...row]) };
    },

    moves(state) {
        const out = [];
        const { board } = state;
        if (state.turn === 'goats') {
            if (state.toPlace > 0) {
                for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) if (!board[r][c]) out.push({ place: [r, c] });
                return out;
            }
            for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) {
                if (board[r][c] !== 'G') continue;
                this.dirs(r, c).forEach(([dr, dc]) => {
                    const nr = r + dr, nc = c + dc;
                    if (this.valid(nr, nc) && !board[nr][nc]) out.push({ from: [r, c], to: [nr, nc] });
                });
            }
            return out;
        }
        for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) {
            if (board[r][c] !== 'T') continue;
            this.dirs(r, c).forEach(([dr, dc]) => {
                const nr = r + dr, nc = c + dc;
                if (!this.valid(nr, nc)) return;
                if (!board[nr][nc]) out.push({ from: [r, c], to: [nr, nc] });
                else if (board[nr][nc] === 'G') {
                    const lr = r + 2 * dr, lc = c + 2 * dc;
                    if (this.valid(lr, lc) && !board[lr][lc]) out.push({ from: [r, c], to: [lr, lc], capture: [nr, nc] });
                }
            });
        }
        return out;
    },

    apply(state, move) {
        const next = this.clone(state);
        if (move.place) {
            next.board[move.place[0]][move.place[1]] = 'G';
            next.toPlace--;
        } else {
            const piece = next.board[move.from[0]][move.from[1]];
            next.board[move.from[0]][move.from[1]] = null;
            next.board[move.to[0]][move.to[1]] = piece;
            if (move.capture) { next.board[move.capture[0]][move.capture[1]] = null; next.captured++; }
        }
        next.turn = state.turn === 'goats' ? 'tigers' : 'goats';
        next.moveCount++;
        return next;
    },

    winner(state) {
        if (state.captured >= 5) return 'tigers';
        if (!this.moves(state).length) return state.turn === 'tigers' ? 'goats' : 'tigers';
        if (state.moveCount >= this.MOVE_CAP) return 'draw';
        return null;
    },

    // Position value from the tigers' point of view
    evaluate(state) {
        const w = this.winner(state);
        if (w === 'tigers') return 10000;
        if (w === 'goats') return -10000;
        if (w === 'draw') return 0;
        const probe = this.clone(state);
        probe.turn = 'tigers';
        const tigerMoves = this.moves(probe);
        const jumps = tigerMoves.filter(m => m.capture).length;
        return state.captured * 120 + tigerMoves.length * 4 + jumps * 20 - (20 - state.toPlace - state.captured) * 1;
    },

    search(state, depth, alpha, beta, deadline) {
        const w = this.winner(state);
        if (w || depth === 0 || Date.now() > deadline) return this.evaluate(state) + (w === 'tigers' ? depth : w === 'goats' ? -depth : 0);
        const max = state.turn === 'tigers';
        const moves = this.moves(state).sort((a, b) => (b.capture ? 1 : 0) - (a.capture ? 1 : 0));
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
        const max = state.turn === 'tigers';
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
        if (state.turn === 'tigers') {
            const jumps = moves.filter(m => m.capture);
            if (jumps.length && Math.random() < 0.7) return jumps[Math.floor(Math.random() * jumps.length)];
        } else {
            // goats avoid points where a tiger could jump them at once, most of the time
            const safe = moves.filter(m => !this.moves(this.apply(state, m)).some(t => t.capture));
            if (safe.length && Math.random() < 0.7) return safe[Math.floor(Math.random() * safe.length)];
        }
        return moves[Math.floor(Math.random() * moves.length)];
    }
};
