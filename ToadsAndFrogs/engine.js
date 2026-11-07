/**
 * Toads and Frogs. A row of squares holds your toads ('T', moving right) and
 * the AI's frogs ('F', moving left) with some empty squares ('_'). A move
 * slides one of your pieces one square forward into an empty square, or jumps
 * over exactly one adjacent enemy piece into the empty square beyond.
 * Whoever cannot move loses. Internally toads are 'B' and frogs 'R'.
 */
const ToadsEngine = {
    create(level) {
        return [...level.row].map(ch => ch === 'T' ? 'B' : ch === 'F' ? 'R' : '.');
    },

    key(state) {
        return state.join('');
    },

    moves(state, player) {
        const dir = player === 'B' ? 1 : -1;
        const enemy = player === 'B' ? 'R' : 'B';
        const out = [];
        state.forEach((ch, i) => {
            if (ch !== player) return;
            if (state[i + dir] === '.') out.push({ from: i, to: i + dir });
            else if (state[i + dir] === enemy && state[i + 2 * dir] === '.') out.push({ from: i, to: i + 2 * dir });
        });
        return out;
    },

    apply(state, { from, to }, player) {
        const next = [...state];
        next[from] = '.';
        next[to] = player;
        return next;
    },

    // ---------- shared AI: perfect play by memoized search, alpha-beta fallback ----------
    other(player) {
        return player === 'B' ? 'R' : 'B';
    },

    resetMemo() {
        this.memo = new Map();
    },

    // True when the side to move wins with best play; throws when the node budget runs out
    search(state, player, budget) {
        const memo = this.memo || (this.memo = new Map());
        const key = player + '|' + this.key(state);
        if (memo.has(key)) return memo.get(key);
        if (++budget.n > budget.max) throw new Error('budget');
        const moves = this.moves(state, player);
        let result = false;
        for (const move of moves) {
            if (!this.search(this.apply(state, move, player), this.other(player), budget)) { result = true; break; }
        }
        memo.set(key, result);
        return result;
    },

    // Mobility evaluation from `player`'s point of view
    evaluate(state, player) {
        const mine = this.moves(state, player).length;
        const theirs = this.moves(state, this.other(player)).length;
        if (!mine) return -1000;
        if (!theirs) return 1000;
        return mine - theirs;
    },

    alphabeta(state, player, me, depth, alpha, beta) {
        const moves = this.moves(state, player);
        if (!moves.length) return player === me ? -1000 - depth : 1000 + depth;
        if (depth === 0) return this.evaluate(state, me);
        const maximizing = player === me;
        let best = maximizing ? -Infinity : Infinity;
        for (const move of moves) {
            const value = this.alphabeta(this.apply(state, move, player), this.other(player), me, depth - 1, alpha, beta);
            if (maximizing) { best = Math.max(best, value); alpha = Math.max(alpha, value); }
            else { best = Math.min(best, value); beta = Math.min(beta, value); }
            if (beta <= alpha) break;
        }
        return best;
    },

    // Novice: random, but never misses a move that leaves the opponent without a reply
    getNoviceMove(state, player) {
        const moves = this.moves(state, player);
        if (!moves.length) return null;
        const killer = moves.find(m => !this.moves(this.apply(state, m, player), this.other(player)).length);
        return killer || moves[Math.floor(Math.random() * moves.length)];
    },

    // Master: a winning move from the full game tree when it fits the budget, else depth-limited search
    getMasterMove(state, player) {
        const moves = this.moves(state, player);
        if (!moves.length) return null;
        const budget = { n: 0, max: 80000 };
        try {
            const winning = [];
            for (const move of moves) {
                if (!this.search(this.apply(state, move, player), this.other(player), budget)) winning.push(move);
            }
            if (winning.length) return winning[Math.floor(Math.random() * winning.length)];
            // lost position: keep the most mobility so the opponent has room to slip
            return moves.reduce((best, m) => this.evaluate(this.apply(state, m, player), player) > this.evaluate(this.apply(state, best, player), player) ? m : best, moves[0]);
        } catch (e) {
            let best = null;
            let bestValue = -Infinity;
            for (const move of moves) {
                const value = this.alphabeta(this.apply(state, move, player), this.other(player), player, 3, -Infinity, Infinity);
                if (value > bestValue) { bestValue = value; best = move; }
            }
            return best;
        }
    },

    // Who wins from a start position with best play ('first' / 'second'), or null when too big to tell
    analyze(state, player) {
        this.resetMemo();
        try { return this.search(state, player, { n: 0, max: 2000000 }) ? 'first' : 'second'; } catch (e) { return null; }
    }
};
