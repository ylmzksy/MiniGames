/**
 * Fox and Geese on the 33-point cross board. Lines run orthogonally between
 * neighboring points and diagonally through the points whose row + column is
 * even. Geese step forward (up the board) or sideways, never back. The fox
 * steps in any direction or jumps over a goose into the empty point beyond,
 * chaining jumps as it likes; captures are never forced.
 * The geese win by trapping the fox; the fox wins when so few geese remain
 * that they cannot trap it, or when the geese have no move left.
 */
const FoxEngine = {
    SIZE: 7,
    MOVE_CAP: 200,

    valid(r, c) {
        return r >= 0 && c >= 0 && r < 7 && c < 7 && ((r >= 2 && r <= 4) || (c >= 2 && c <= 4));
    },

    // Directions a line leaves (r, c) in: orthogonal always, diagonal on even points
    dirs(r, c) {
        const out = [[-1, 0], [1, 0], [0, -1], [0, 1]];
        if ((r + c) % 2 === 0) out.push([-1, -1], [-1, 1], [1, -1], [1, 1]);
        return out;
    },

    create(level) {
        const board = Array.from({ length: 7 }, () => Array(7).fill(null));
        const geese = [];
        for (let r = 4; r < 7; r++) for (let c = 0; c < 7; c++) if (this.valid(r, c)) geese.push([r, c]);
        if (level.geese === 17) geese.push([3, 0], [3, 1], [3, 5], [3, 6]);
        geese.forEach(([r, c]) => { board[r][c] = 'G'; });
        const fox = level.geese === 17 ? [1, 3] : [3, 3];
        board[fox[0]][fox[1]] = 'F';
        return { board, fox, turn: 'geese', captured: 0, startGeese: geese.length, foxWinsAt: level.foxWinsAt, moveCount: 0 };
    },

    clone(state) {
        return { ...state, board: state.board.map(row => [...row]), fox: [...state.fox] };
    },

    geeseCount(state) {
        return state.board.flat().filter(v => v === 'G').length;
    },

    moves(state) {
        const out = [];
        const { board } = state;
        if (state.turn === 'geese') {
            for (let r = 0; r < 7; r++) for (let c = 0; c < 7; c++) {
                if (board[r][c] !== 'G') continue;
                this.dirs(r, c).forEach(([dr, dc]) => {
                    if (dr > 0) return; // never backwards
                    const nr = r + dr, nc = c + dc;
                    if (this.valid(nr, nc) && !board[nr][nc]) out.push({ from: [r, c], to: [nr, nc], captures: [] });
                });
            }
            return out;
        }
        const [fr, fc] = state.fox;
        this.dirs(fr, fc).forEach(([dr, dc]) => {
            const nr = fr + dr, nc = fc + dc;
            if (this.valid(nr, nc) && !board[nr][nc]) out.push({ from: [fr, fc], to: [nr, nc], captures: [] });
        });
        // jump chains: explore recursively, every stopping point is a legal move
        const taken = new Set();
        const rec = (r, c, caps, path) => {
            this.dirs(r, c).forEach(([dr, dc]) => {
                const mr = r + dr, mc = c + dc, lr = r + 2 * dr, lc = c + 2 * dc;
                const key = `${mr},${mc}`;
                if (!this.valid(lr, lc) || board[mr][mc] !== 'G' || taken.has(key)) return;
                if (board[lr][lc] && !(lr === fr && lc === fc)) return;
                taken.add(key);
                const nextCaps = [...caps, [mr, mc]];
                const nextPath = [...path, [lr, lc]];
                out.push({ from: [fr, fc], to: [lr, lc], captures: nextCaps, path: nextPath });
                rec(lr, lc, nextCaps, nextPath);
                taken.delete(key);
            });
        };
        rec(fr, fc, [], []);
        return out;
    },

    apply(state, move) {
        const next = this.clone(state);
        const piece = next.board[move.from[0]][move.from[1]];
        next.board[move.from[0]][move.from[1]] = null;
        move.captures.forEach(([r, c]) => { next.board[r][c] = null; });
        next.board[move.to[0]][move.to[1]] = piece;
        if (piece === 'F') next.fox = [...move.to];
        next.captured += move.captures.length;
        next.turn = state.turn === 'geese' ? 'fox' : 'geese';
        next.moveCount++;
        return next;
    },

    winner(state) {
        if (this.geeseCount(state) <= state.foxWinsAt) return 'fox';
        if (!this.moves(state).length) return state.turn === 'fox' ? 'geese' : 'fox';
        if (state.moveCount >= this.MOVE_CAP) return 'draw';
        return null;
    },

    // Position value from the fox's point of view
    evaluate(state) {
        const w = this.winner(state);
        if (w === 'fox') return 10000;
        if (w === 'geese') return -10000;
        if (w === 'draw') return 0;
        const saved = this.clone(state);
        saved.turn = 'fox';
        const foxMoves = this.moves(saved);
        let score = state.captured * 80 + foxMoves.length * 5 + foxMoves.filter(m => m.captures.length).length * 12;
        for (let r = 0; r < 7; r++) for (let c = 0; c < 7; c++) {
            if (state.board[r][c] !== 'G') continue;
            if (r < state.fox[0]) score += 6;      // a goose that has passed the fox is wasted
            else score -= Math.max(0, 3 - (Math.abs(r - state.fox[0]) + Math.abs(c - state.fox[1]))) * 2;
        }
        return score;
    },

    search(state, depth, alpha, beta, deadline) {
        const w = this.winner(state);
        if (w || depth === 0 || Date.now() > deadline) return this.evaluate(state) * (w ? 1 : 1) + (w === 'fox' ? depth : w === 'geese' ? -depth : 0);
        const max = state.turn === 'fox';
        const moves = this.moves(state).sort((a, b) => b.captures.length - a.captures.length);
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
        const max = state.turn === 'fox';
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
        if (state.turn === 'fox') {
            const jumps = moves.filter(m => m.captures.length);
            if (jumps.length && Math.random() < 0.7) return jumps[Math.floor(Math.random() * jumps.length)];
        }
        return moves[Math.floor(Math.random() * moves.length)];
    }
};
