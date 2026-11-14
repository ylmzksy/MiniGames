/**
 * Yoté. Each side holds a hand of pieces and places, steps or jumps. A turn:
 *   place  a piece from your hand onto any empty square
 *   step   a piece one square orthogonally into an empty square
 *   jump   over an orthogonally adjacent enemy piece into the empty square
 *          beyond, capturing it, and then remove one more enemy piece from
 *          the board as a bonus (if any remains)
 * A side with no pieces left (board and hand) loses. Forty turns without a
 * capture is a draw.
 * State: rows, cols, board[r][c] ('you', 'ai', null), hand { you, ai }, turn.
 */
const YoteEngine = {
    dirs: [[-1, 0], [1, 0], [0, -1], [0, 1]],

    create(level) {
        return {
            rows: level.rows, cols: level.cols,
            board: Array.from({ length: level.rows }, () => Array(level.cols).fill(null)),
            hand: { you: level.pieces, ai: level.pieces },
            turn: 'you', quiet: 0, winner: null
        };
    },

    clone(state) {
        return { rows: state.rows, cols: state.cols, board: state.board.map(r => r.slice()), hand: { ...state.hand }, turn: state.turn, quiet: state.quiet, winner: state.winner };
    },

    other(p) {
        return p === 'you' ? 'ai' : 'you';
    },

    inside(state, r, c) {
        return r >= 0 && c >= 0 && r < state.rows && c < state.cols;
    },

    count(state, player) {
        let n = 0;
        state.board.forEach(row => row.forEach(v => { if (v === player) n++; }));
        return n;
    },

    pieces(state, player) {
        const out = [];
        state.board.forEach((row, r) => row.forEach((v, c) => { if (v === player) out.push([r, c]); }));
        return out;
    },

    // Moves without the bonus choice; jumps carry `captures` and need a bonus
    moves(state, player = state.turn) {
        const out = [];
        if (state.hand[player] > 0) {
            for (let r = 0; r < state.rows; r++) for (let c = 0; c < state.cols; c++) if (!state.board[r][c]) out.push({ type: 'place', to: [r, c] });
        }
        const enemy = this.other(player);
        for (const [r, c] of this.pieces(state, player)) {
            for (const [dr, dc] of this.dirs) {
                const nr = r + dr, nc = c + dc;
                if (!this.inside(state, nr, nc)) continue;
                if (!state.board[nr][nc]) out.push({ type: 'step', from: [r, c], to: [nr, nc] });
                else if (state.board[nr][nc] === enemy) {
                    const jr = nr + dr, jc = nc + dc;
                    if (this.inside(state, jr, jc) && !state.board[jr][jc]) out.push({ type: 'jump', from: [r, c], to: [jr, jc], captured: [nr, nc] });
                }
            }
        }
        return out;
    },

    // Enemy pieces that may be removed as the bonus after a jump
    bonusOptions(state, move, player = state.turn) {
        const enemy = this.other(player);
        return this.pieces(state, enemy).filter(([r, c]) => !(r === move.captured[0] && c === move.captured[1]));
    },

    apply(state, move) {
        const next = this.clone(state);
        const player = state.turn;
        if (move.type === 'place') {
            next.board[move.to[0]][move.to[1]] = player;
            next.hand[player] -= 1;
            next.quiet += 1;
        } else {
            next.board[move.from[0]][move.from[1]] = null;
            next.board[move.to[0]][move.to[1]] = player;
            if (move.type === 'jump') {
                next.board[move.captured[0]][move.captured[1]] = null;
                if (move.bonus) next.board[move.bonus[0]][move.bonus[1]] = null;
                next.quiet = 0;
            } else {
                next.quiet += 1;
            }
        }
        next.turn = this.other(player);
        const enemy = this.other(player);
        if (this.count(next, enemy) + next.hand[enemy] === 0) next.winner = player;
        else if (next.quiet >= 40) next.winner = 'draw';
        return next;
    },

    // Full turns for the search: jumps expanded with a few bonus choices
    turns(state, player = state.turn) {
        const out = [];
        for (const m of this.moves(state, player)) {
            if (m.type !== 'jump') { out.push(m); continue; }
            const options = this.bonusOptions(state, m, player);
            if (!options.length) { out.push({ ...m, bonus: null }); continue; }
            // prefer removing pieces that could jump us next
            const ranked = options.map(b => ({ b, score: this.threatScore(state, b, player) })).sort((x, y) => y.score - x.score).slice(0, 3);
            ranked.forEach(({ b }) => out.push({ ...m, bonus: b }));
        }
        return out;
    },

    threatScore(state, [r, c], player) {
        let s = 0;
        for (const [dr, dc] of this.dirs) {
            const nr = r + dr, nc = c + dc;
            if (this.inside(state, nr, nc) && state.board[nr][nc] === player) s += 2;
        }
        return s + Math.random() * 0.1;
    },

    evaluate(state) {
        const material = (this.count(state, 'ai') + state.hand.ai) - (this.count(state, 'you') + state.hand.you);
        const mobility = this.moves(state, 'ai').length - this.moves(state, 'you').length;
        return material * 10 + mobility * 0.3;
    },

    search(state, depth, alpha, beta, deadline) {
        if (state.winner) return state.winner === 'ai' ? 1000 + depth : state.winner === 'you' ? -1000 - depth : 0;
        if (depth === 0 || Date.now() > deadline) return this.evaluate(state);
        const player = state.turn;
        const turns = this.turns(state, player);
        if (!turns.length) return player === 'ai' ? -1000 - depth : 1000 + depth;
        turns.sort((a, b) => (b.type === 'jump') - (a.type === 'jump'));
        const maximizing = player === 'ai';
        let best = maximizing ? -Infinity : Infinity;
        for (const t of turns) {
            const value = this.search(this.apply(state, t), depth - 1, alpha, beta, deadline);
            if (maximizing) { best = Math.max(best, value); alpha = Math.max(alpha, value); }
            else { best = Math.min(best, value); beta = Math.min(beta, value); }
            if (beta <= alpha) break;
        }
        return best;
    },

    getMasterMove(state, depth, budgetMs = 800) {
        const deadline = Date.now() + budgetMs;
        const turns = this.turns(state, 'ai');
        if (!turns.length) return null;
        let best = null;
        for (let d = 1; d <= depth; d++) {
            let bestThis = null;
            for (const t of turns) {
                const value = this.search(this.apply(state, t), d - 1, -Infinity, Infinity, deadline);
                if (!bestThis || value > bestThis.value) bestThis = { move: t, value };
            }
            if (Date.now() > deadline && best) break;
            best = bestThis;
        }
        return best.move;
    },

    getNoviceMove(state) {
        const turns = this.turns(state, 'ai');
        if (!turns.length) return null;
        const jumps = turns.filter(t => t.type === 'jump');
        if (jumps.length) return jumps[Math.floor(Math.random() * jumps.length)];
        // avoid stepping or placing where it can be jumped at once
        const safe = turns.filter(t => !this.moves(this.apply(state, t), 'you').some(m => m.type === 'jump'));
        const pool = safe.length ? safe : turns;
        return pool[Math.floor(Math.random() * pool.length)];
    }
};
