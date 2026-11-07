/**
 * Nine Men's Morris. 24 points on three nested squares joined at the
 * midpoints. Each side places nine men, then slides them along lines; a side
 * down to three men may fly anywhere. Three in a line (a mill) removes an
 * enemy man that is not in a mill (any man if all are). A side with two men,
 * or with no legal move, loses. The player is side 0 and starts.
 * A move: { type: 'place'|'move', from?, to, remove? }.
 */
const MorrisEngine = {
    // Point coordinates on a 7x7 layout
    points: [[0, 0], [3, 0], [6, 0], [1, 1], [3, 1], [5, 1], [2, 2], [3, 2], [4, 2],
             [0, 3], [1, 3], [2, 3], [4, 3], [5, 3], [6, 3],
             [2, 4], [3, 4], [4, 4], [1, 5], [3, 5], [5, 5], [0, 6], [3, 6], [6, 6]],
    mills: [[0, 1, 2], [3, 4, 5], [6, 7, 8], [9, 10, 11], [12, 13, 14], [15, 16, 17], [18, 19, 20], [21, 22, 23],
            [0, 9, 21], [3, 10, 18], [6, 11, 15], [1, 4, 7], [16, 19, 22], [8, 12, 17], [5, 13, 20], [2, 14, 23]],

    get adjacency() {
        if (!this._adj) {
            const adj = Array.from({ length: 24 }, () => []);
            this.mills.forEach(([a, b, c]) => { adj[a].push(b); adj[b].push(a, c); adj[c].push(b); });
            this._adj = adj;
        }
        return this._adj;
    },

    create(level) {
        return { board: Array(24).fill(null), inHand: [level.men, level.men], turn: 0 };
    },

    clone(state) {
        return { board: [...state.board], inHand: [...state.inHand], turn: state.turn };
    },

    count(state, side) {
        return state.board.filter(v => v === side).length;
    },

    inMill(board, i, side) {
        return this.mills.some(m => m.includes(i) && m.every(p => board[p] === side));
    },

    removable(board, side) {
        const enemy = 1 - side;
        const men = board.map((v, i) => v === enemy ? i : -1).filter(i => i >= 0);
        const free = men.filter(i => !this.inMill(board, i, enemy));
        return free.length ? free : men;
    },

    // Moves for the side to play, each with its possible removals expanded
    moves(state, side = state.turn) {
        const out = [];
        const expand = (base, board) => {
            if (this.inMill(board, base.to, side)) {
                this.removable(board, side).forEach(r => out.push({ ...base, remove: r }));
            } else {
                out.push(base);
            }
        };
        if (state.inHand[side] > 0) {
            state.board.forEach((v, to) => {
                if (v !== null) return;
                const board = [...state.board]; board[to] = side;
                expand({ type: 'place', to }, board);
            });
            return out;
        }
        const flying = this.count(state, side) === 3;
        state.board.forEach((v, from) => {
            if (v !== side) return;
            const targets = flying ? state.board.map((x, i) => x === null ? i : -1).filter(i => i >= 0) : this.adjacency[from].filter(i => state.board[i] === null);
            targets.forEach(to => {
                const board = [...state.board]; board[from] = null; board[to] = side;
                expand({ type: 'move', from, to }, board);
            });
        });
        return out;
    },

    apply(state, move) {
        const next = this.clone(state);
        const side = state.turn;
        if (move.type === 'place') next.inHand[side]--;
        else next.board[move.from] = null;
        next.board[move.to] = side;
        if (move.remove !== undefined) next.board[move.remove] = null;
        next.turn = 1 - side;
        return next;
    },

    // Winner index when the side to play has lost, else null
    result(state) {
        const side = state.turn;
        if (state.inHand[side] === 0 && this.count(state, side) < 3) return { winner: 1 - side };
        if (!this.moves(state).length) return { winner: 1 - side };
        return null;
    },

    phase(state, side) {
        if (state.inHand[side] > 0) return 'placing';
        return this.count(state, side) === 3 ? 'flying' : 'moving';
    },

    // Value from the AI's (side 1) point of view
    evaluate(state) {
        const score = side => {
            const men = this.count(state, side) + state.inHand[side];
            let mills = 0, twos = 0;
            this.mills.forEach(m => {
                const own = m.filter(p => state.board[p] === side).length;
                const empty = m.filter(p => state.board[p] === null).length;
                if (own === 3) mills++;
                if (own === 2 && empty === 1) twos++;
            });
            const mobility = state.inHand[side] > 0 ? 0 : this.moves({ ...state, turn: side }, side).length;
            return men * 10 + mills * 8 + twos * 3 + Math.min(mobility, 12);
        };
        return score(1) - score(0);
    },

    search(state, depth, alpha, beta) {
        const res = this.result(state);
        if (res) return res.winner === 1 ? 10000 + depth : -10000 - depth;
        if (depth === 0) return this.evaluate(state);
        const maximizing = state.turn === 1;
        let best = maximizing ? -Infinity : Infinity;
        for (const move of this.moves(state)) {
            const value = this.search(this.apply(state, move), depth - 1, alpha, beta);
            if (maximizing) { best = Math.max(best, value); alpha = Math.max(alpha, value); }
            else { best = Math.min(best, value); beta = Math.min(beta, value); }
            if (beta <= alpha) break;
        }
        return best;
    },

    bestMove(state, depth) {
        const moves = this.moves(state);
        let best = [];
        let bestValue = -Infinity;
        for (const move of moves) {
            const value = this.search(this.apply(state, move), depth - 1, -Infinity, Infinity);
            if (value > bestValue) { bestValue = value; best = [move]; }
            else if (value === bestValue) best.push(move);
        }
        return best.length ? best[Math.floor(Math.random() * best.length)] : null;
    },

    getNoviceMove(state) {
        return this.bestMove(state, 1);
    },

    // Placing has a wide branching factor, so the search is one ply shallower there
    getMasterMove(state, depth) {
        const d = state.inHand[1] > 0 ? Math.max(2, depth - 1) : depth;
        return this.bestMove(state, d);
    }
};
