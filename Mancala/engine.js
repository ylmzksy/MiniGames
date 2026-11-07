/**
 * Mancala (Kalah). Pits 0-5 and store 6 belong to the player, pits 7-12 and
 * store 13 to the AI. Seeds are sown counterclockwise, skipping the opponent's
 * store. A last seed in your own store gives another turn; a last seed in an
 * empty pit of yours captures the opposite pit. When one side is empty the
 * other side keeps its remaining seeds; the bigger store wins.
 */
const MancalaEngine = {
    create(level) {
        const pits = Array(14).fill(level.seeds);
        pits[6] = 0;
        pits[13] = 0;
        return { pits, turn: 0, over: false, winner: null };
    },

    clone(state) {
        return { pits: [...state.pits], turn: state.turn, over: state.over, winner: state.winner };
    },

    store(side) { return side === 0 ? 6 : 13; },
    own(side) { return side === 0 ? [0, 1, 2, 3, 4, 5] : [7, 8, 9, 10, 11, 12]; },

    moves(state, side = state.turn) {
        return this.own(side).filter(i => state.pits[i] > 0);
    },

    // Applies a move; returns the new state (turn stays when an extra turn was earned)
    apply(state, pit) {
        const next = this.clone(state);
        const side = state.turn;
        const skip = this.store(1 - side);
        let seeds = next.pits[pit];
        next.pits[pit] = 0;
        let idx = pit;
        while (seeds > 0) {
            idx = (idx + 1) % 14;
            if (idx === skip) continue;
            next.pits[idx]++;
            seeds--;
        }
        const mine = this.own(side);
        let extra = false;
        if (idx === this.store(side)) {
            extra = true;
        } else if (mine.includes(idx) && next.pits[idx] === 1 && next.pits[12 - idx] > 0) {
            next.pits[this.store(side)] += next.pits[12 - idx] + 1;
            next.pits[idx] = 0;
            next.pits[12 - idx] = 0;
        }
        next.last = idx;
        next.turn = extra ? side : 1 - side;
        this.checkEnd(next);
        return next;
    },

    checkEnd(state) {
        const empty = side => this.own(side).every(i => state.pits[i] === 0);
        if (!empty(0) && !empty(1)) return;
        [0, 1].forEach(side => {
            this.own(side).forEach(i => { state.pits[this.store(side)] += state.pits[i]; state.pits[i] = 0; });
        });
        state.over = true;
        state.winner = state.pits[6] > state.pits[13] ? 0 : state.pits[13] > state.pits[6] ? 1 : null;
    },

    // Value from the AI's point of view
    evaluate(state) {
        return state.pits[13] - state.pits[6];
    },

    search(state, depth, alpha, beta) {
        if (state.over || depth === 0) return this.evaluate(state);
        const moves = this.moves(state);
        const maximizing = state.turn === 1;
        let best = maximizing ? -Infinity : Infinity;
        for (const pit of moves) {
            const next = this.apply(state, pit);
            // an extra turn does not cost a ply
            const value = this.search(next, next.turn === state.turn ? depth : depth - 1, alpha, beta);
            if (maximizing) { best = Math.max(best, value); alpha = Math.max(alpha, value); }
            else { best = Math.min(best, value); beta = Math.min(beta, value); }
            if (beta <= alpha) break;
        }
        return best;
    },

    bestMove(state, depth) {
        const moves = this.moves(state);
        let best = null;
        for (const pit of moves) {
            const next = this.apply(state, pit);
            const value = this.search(next, next.turn === state.turn ? depth : depth - 1, -Infinity, Infinity);
            if (!best || value > best.value) best = { pit, value };
        }
        return best ? best.pit : null;
    },

    getNoviceMove(state) {
        const moves = this.moves(state);
        return Math.random() < 0.5 ? moves[Math.floor(Math.random() * moves.length)] : this.bestMove(state, 1);
    },

    getMasterMove(state, depth) {
        return this.bestMove(state, depth);
    }
};
