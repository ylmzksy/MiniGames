/**
 * Isolation. Two pieces on a grid. A turn is a step to an adjacent square
 * (eight directions) followed by removing any empty square from the board.
 * Whoever cannot step loses.
 * State: n, holes (Set of "r,c"), pieces { you, ai }, turn, phase.
 */
const IsolationEngine = {
    dirs: [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]],

    create(level) {
        const n = level.size;
        const mid = Math.floor(n / 2);
        return { n, holes: new Set(), pieces: { you: [n - 1, mid], ai: [0, mid] }, turn: 'you' };
    },

    clone(state) {
        return { n: state.n, holes: new Set(state.holes), pieces: { you: [...state.pieces.you], ai: [...state.pieces.ai] }, turn: state.turn };
    },

    other(p) {
        return p === 'you' ? 'ai' : 'you';
    },

    free(state, r, c) {
        if (r < 0 || c < 0 || r >= state.n || c >= state.n) return false;
        if (state.holes.has(`${r},${c}`)) return false;
        const { you, ai } = state.pieces;
        return !(you[0] === r && you[1] === c) && !(ai[0] === r && ai[1] === c);
    },

    steps(state, player) {
        const [r, c] = state.pieces[player];
        return this.dirs.map(([dr, dc]) => [r + dr, c + dc]).filter(([nr, nc]) => this.free(state, nr, nc));
    },

    emptySquares(state) {
        const out = [];
        for (let r = 0; r < state.n; r++) for (let c = 0; c < state.n; c++) if (this.free(state, r, c)) out.push([r, c]);
        return out;
    },

    // Full turn: step then remove
    apply(state, move) {
        const next = this.clone(state);
        next.pieces[state.turn] = [move.to[0], move.to[1]];
        next.holes.add(`${move.remove[0]},${move.remove[1]}`);
        next.turn = this.other(state.turn);
        return next;
    },

    // Squares reachable by walking, as a tiebreak when the pieces are separated
    area(state, player) {
        const start = state.pieces[player];
        const seen = new Set([`${start[0]},${start[1]}`]);
        const queue = [start];
        while (queue.length) {
            const [r, c] = queue.pop();
            for (const [dr, dc] of this.dirs) {
                const nr = r + dr, nc = c + dc;
                const key = `${nr},${nc}`;
                if (seen.has(key) || !this.free(state, nr, nc)) continue;
                seen.add(key);
                queue.push([nr, nc]);
            }
        }
        return seen.size - 1;
    },

    evaluate(state) {
        const ma = this.steps(state, 'ai').length;
        const my = this.steps(state, 'you').length;
        return (ma - my) * 3 + (this.area(state, 'ai') - this.area(state, 'you')) * 0.5;
    },

    // Removal candidates: squares next to the opponent first, then within two
    candidates(state, player) {
        const opp = state.pieces[this.other(player)];
        const near = [];
        const wider = [];
        for (const [r, c] of this.emptySquares(state)) {
            const d = Math.max(Math.abs(r - opp[0]), Math.abs(c - opp[1]));
            if (d === 1) near.push([r, c]); else if (d === 2) wider.push([r, c]);
        }
        const removes = near.length >= 3 ? near : near.concat(wider);
        const moves = [];
        for (const to of this.steps(state, player)) {
            const probe = this.clone(state);
            probe.pieces[player] = to;
            for (const rm of removes) {
                if (rm[0] === to[0] && rm[1] === to[1]) continue;
                moves.push({ to, remove: rm });
            }
            if (!removes.length) {
                const any = this.emptySquares(probe)[0];
                if (any) moves.push({ to, remove: any });
            }
        }
        return moves;
    },

    search(state, depth, alpha, beta, deadline) {
        const player = state.turn;
        const moves = this.candidates(state, player);
        if (!moves.length) return player === 'ai' ? -1000 - depth : 1000 + depth;
        if (depth === 0 || Date.now() > deadline) return this.evaluate(state);
        const maximizing = player === 'ai';
        let best = maximizing ? -Infinity : Infinity;
        for (const move of moves) {
            const value = this.search(this.apply(state, move), depth - 1, alpha, beta, deadline);
            if (maximizing) { best = Math.max(best, value); alpha = Math.max(alpha, value); }
            else { best = Math.min(best, value); beta = Math.min(beta, value); }
            if (beta <= alpha) break;
        }
        return best;
    },

    getMasterMove(state, depth, budgetMs = 800) {
        const deadline = Date.now() + budgetMs;
        const moves = this.candidates(state, 'ai');
        if (!moves.length) return null;
        let best = null;
        for (let d = 1; d <= depth; d++) {
            let bestThis = null;
            for (const move of moves) {
                const value = this.search(this.apply(state, move), d - 1, -Infinity, Infinity, deadline);
                if (!bestThis || value > bestThis.value) bestThis = { move, value };
            }
            if (Date.now() > deadline && best) break;
            best = bestThis;
        }
        return best.move;
    },

    getNoviceMove(state) {
        const moves = this.candidates(state, 'ai');
        if (!moves.length) return null;
        // keep its own mobility, otherwise random
        let best = null;
        for (const move of moves) {
            const next = this.apply(state, move);
            const score = this.steps(next, 'ai').length - this.steps(next, 'you').length + Math.random() * 2;
            if (!best || score > best.score) best = { move, score };
        }
        return best.move;
    }
};
