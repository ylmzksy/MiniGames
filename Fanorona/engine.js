/**
 * Fanorona. A 5x9 board of points with orthogonal lines and diagonals through
 * every other point; 22 pieces each. A piece steps along a line to an empty
 * neighbor. Moving toward an enemy captures the whole unbroken line of
 * enemies ahead (approach); moving away from one captures the line behind
 * (withdrawal). After a capture the same piece may capture again, each time
 * in a new direction and never returning to a point of this turn. Captures
 * are mandatory. Capturing every enemy piece wins; forty half-moves without a
 * capture is a draw. You are black, side 0, at the bottom.
 * A move is { from, path, captures, dirs } where captures lists all taken points.
 */
const FanoronaEngine = {
    BUDGET_MS: 800,
    ROWS: 5,
    COLS: 9,
    ORTHO: [[1, 0], [-1, 0], [0, 1], [0, -1]],
    DIAG: [[1, 1], [1, -1], [-1, 1], [-1, -1]],

    create() {
        const board = Array.from({ length: this.ROWS }, () => Array(this.COLS).fill(null));
        for (let c = 0; c < this.COLS; c++) { board[0][c] = 1; board[1][c] = 1; board[3][c] = 0; board[4][c] = 0; }
        [...'WBWB.WBWB'].forEach((ch, c) => { board[2][c] = ch === 'W' ? 1 : ch === 'B' ? 0 : null; });
        return { rows: this.ROWS, cols: this.COLS, board, turn: 0, quiet: 0 };
    },

    clone(state) {
        return { rows: state.rows, cols: state.cols, board: state.board.map(row => [...row]), turn: state.turn, quiet: state.quiet };
    },

    inside(state, r, c) {
        return r >= 0 && c >= 0 && r < state.rows && c < state.cols;
    },

    dirs(r, c) {
        return (r + c) % 2 === 0 ? [...this.ORTHO, ...this.DIAG] : this.ORTHO;
    },

    // Enemy points taken by approach or withdrawal for a step from (r, c) in direction d
    line(board, state, r, c, dr, dc, side) {
        const out = [];
        let pr = r + dr;
        let pc = c + dc;
        while (this.inside(state, pr, pc) && board[pr][pc] === 1 - side) {
            out.push([pr, pc]);
            pr += dr;
            pc += dc;
        }
        return out;
    },

    // Capturing continuations from (r, c) on a working board
    captureMoves(state, board, r, c, side, path, captures, lastDir, visited, stepCaptures = [], kinds = []) {
        const out = [];
        for (const [dr, dc] of this.dirs(r, c)) {
            if (lastDir && lastDir[0] === dr && lastDir[1] === dc) continue;
            const nr = r + dr;
            const nc = c + dc;
            if (!this.inside(state, nr, nc) || board[nr][nc] !== null || visited.has(`${nr},${nc}`)) continue;
            const approach = this.line(board, state, nr, nc, dr, dc, side);
            const withdrawal = this.line(board, state, r, c, -dr, -dc, side);
            for (const taken of [approach, withdrawal]) {
                if (!taken.length) continue;
                const nextBoard = board.map(row => [...row]);
                nextBoard[r][c] = null;
                nextBoard[nr][nc] = side;
                taken.forEach(([tr, tc]) => { nextBoard[tr][tc] = null; });
                const nextPath = [...path, [nr, nc]];
                const nextCaptures = [...captures, ...taken];
                const nextVisited = new Set(visited);
                nextVisited.add(`${nr},${nc}`);
                const nextSteps = [...stepCaptures, taken];
                const nextKinds = [...kinds, taken === approach ? 'approach' : 'withdrawal'];
                out.push({ from: path[0], path: nextPath, captures: nextCaptures, stepCaptures: nextSteps, kinds: nextKinds });
                out.push(...this.captureMoves(state, nextBoard, nr, nc, side, nextPath, nextCaptures, [dr, dc], nextVisited, nextSteps, nextKinds));
            }
        }
        return out;
    },

    moves(state, side = state.turn) {
        const captures = [];
        const steps = [];
        for (let r = 0; r < state.rows; r++) {
            for (let c = 0; c < state.cols; c++) {
                if (state.board[r][c] !== side) continue;
                captures.push(...this.captureMoves(state, state.board, r, c, side, [[r, c]], [], null, new Set([`${r},${c}`])));
                for (const [dr, dc] of this.dirs(r, c)) {
                    const nr = r + dr;
                    const nc = c + dc;
                    if (this.inside(state, nr, nc) && state.board[nr][nc] === null) steps.push({ from: [r, c], path: [[r, c], [nr, nc]], captures: [], stepCaptures: [[]], kinds: ['step'] });
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
        if (!this.count(state, 0)) return { winner: 1 };
        if (!this.count(state, 1)) return { winner: 0 };
        if (!this.moves(state).length) return { winner: 1 - state.turn };
        if (state.quiet >= 40) return { winner: null };
        return null;
    },

    evaluate(state) {
        return (this.count(state, 1) - this.count(state, 0)) * 100;
    },

    search(state, depth, alpha, beta, deadline) {
        const res = this.result(state);
        if (res) return res.winner === null ? 0 : res.winner === 1 ? 10000 + depth : -10000 - depth;
        if (depth === 0 || Date.now() > deadline) return this.evaluate(state);
        const maximizing = state.turn === 1;
        let best = maximizing ? -Infinity : Infinity;
        // captures first so the pruning bites
        const moves = this.moves(state).sort((a, b) => b.captures.length - a.captures.length);
        for (const move of moves) {
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
        // a novice still takes the biggest capture available
        const most = Math.max(...moves.map(m => m.captures.length));
        const pool = moves.filter(m => m.captures.length === most);
        return pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
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
