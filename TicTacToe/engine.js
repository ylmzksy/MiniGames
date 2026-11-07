/**
 * Tic-tac-toe on an n x n board: line up `win` marks in a row, column or
 * diagonal. In misère play, completing such a line loses instead.
 * Board cells: 0 empty, 1 you (X), 2 the AI (O).
 */
const TttEngine = {
    create(level) {
        return { size: level.size, win: level.win, misere: !!level.misere, board: Array(level.size * level.size).fill(0), turn: 1, lines: this.lines(level.size, level.win) };
    },

    lines(n, k) {
        const out = [];
        const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
        for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) for (const [dr, dc] of dirs) {
            const line = [];
            for (let i = 0; i < k; i++) {
                const rr = r + dr * i, cc = c + dc * i;
                if (rr < 0 || cc < 0 || rr >= n || cc >= n) break;
                line.push(rr * n + cc);
            }
            if (line.length === k) out.push(line);
        }
        return out;
    },

    // The completed line of player p, if any
    lineOf(state, p) {
        return state.lines.find(l => l.every(i => state.board[i] === p)) || null;
    },

    empties(state) {
        return state.board.map((v, i) => v === 0 ? i : -1).filter(i => i >= 0);
    },

    // Result after the last move by `p`: 'win' for p, 'lose' for p (misère), null if the game goes on, 'draw' when full
    outcome(state, p) {
        const line = this.lineOf(state, p);
        if (line) return state.misere ? 'lose' : 'win';
        return this.empties(state).length ? null : 'draw';
    },

    // Score from the AI's (2) view after player p moved: +1 AI wins, -1 AI loses, 0 draw, null ongoing
    terminal(state, p) {
        const o = this.outcome(state, p);
        if (o === null) return null;
        if (o === 'draw') return 0;
        const pWins = o === 'win';
        return (pWins === (p === 2)) ? 1 : -1;
    },

    evaluate(state) {
        let score = 0;
        for (const l of state.lines) {
            let a = 0, b = 0;
            for (const i of l) { if (state.board[i] === 2) a++; else if (state.board[i] === 1) b++; }
            if (a && b) continue;
            if (a) score += Math.pow(10, a - 1);
            if (b) score -= Math.pow(10, b - 1);
        }
        return state.misere ? -score : score;
    },

    search(state, p, depth, alpha, beta, memo, deadline) {
        // p = player who just moved; next mover is 3 - p
        const t = this.terminal(state, p);
        if (t !== null) return t * (1 + depth * 0.01);
        if (depth === 0 || Date.now() > deadline) return this.evaluate(state) / 1000;
        const key = memo ? state.board.join('') + p : null;
        if (memo && memo.has(key)) return memo.get(key);
        const mover = 3 - p;
        const maximizing = mover === 2;
        let best = maximizing ? -Infinity : Infinity;
        for (const i of this.empties(state)) {
            state.board[i] = mover;
            const v = this.search(state, mover, depth - 1, alpha, beta, memo, deadline);
            state.board[i] = 0;
            if (maximizing) { best = Math.max(best, v); alpha = Math.max(alpha, v); }
            else { best = Math.min(best, v); beta = Math.min(beta, v); }
            if (beta <= alpha) break;
        }
        if (memo) memo.set(key, best);
        return best;
    },

    getMasterMove(state) {
        const full = state.size === 3;
        const depth = full ? 99 : state.size === 4 ? 4 : 3;
        const memo = full ? new Map() : null;
        const deadline = Date.now() + 700;
        let best = null;
        for (const i of this.empties(state)) {
            state.board[i] = 2;
            const v = this.search(state, 2, depth - 1, -Infinity, Infinity, memo, deadline);
            state.board[i] = 0;
            if (!best || v > best.v) best = { i, v };
        }
        return best.i;
    },

    getNoviceMove(state) {
        const empties = this.empties(state);
        const completes = (i, p) => { state.board[i] = p; const l = this.lineOf(state, p); state.board[i] = 0; return !!l; };
        if (!state.misere) {
            const win = empties.find(i => completes(i, 2));
            if (win !== undefined) return win;
            const block = empties.find(i => completes(i, 1));
            if (block !== undefined) return block;
        }
        const safe = empties.filter(i => !(state.misere && completes(i, 2)));
        const pool = safe.length ? safe : empties;
        return pool[Math.floor(Math.random() * pool.length)];
    }
};
