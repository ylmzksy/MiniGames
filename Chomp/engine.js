/**
 * Chomp. A chocolate bar of rows x cols squares; the top-left square is
 * poisoned. A move picks a square and eats it together with every square to
 * the right of it and below it. Whoever eats the poisoned square loses.
 * A state is the list of row lengths, which is always non-increasing.
 */
const ChompEngine = {
    create(level) {
        return Array(level.rows).fill(level.cols);
    },

    squaresLeft(state) {
        return state.reduce((sum, n) => sum + n, 0);
    },

    isSquare(state, r, c) {
        return r < state.length && c < state[r];
    },

    // Eats (r, c) and everything right of and below it
    eat(state, r, c) {
        return state.map((len, i) => i >= r ? Math.min(len, c) : len);
    },

    moves(state) {
        const out = [];
        state.forEach((len, r) => { for (let c = 0; c < len; c++) out.push([r, c]); });
        return out;
    },

    key(state) {
        return state.join(',');
    },

    // True when the side to move can force a win (eating the poison is never chosen)
    isWinning(state, memo = this.memo || (this.memo = new Map())) {
        const key = this.key(state);
        if (memo.has(key)) return memo.get(key);
        let result = false;
        for (const [r, c] of this.moves(state)) {
            if (r === 0 && c === 0) continue;
            if (!this.isWinning(this.eat(state, r, c), memo)) { result = true; break; }
        }
        memo.set(key, result);
        return result;
    },

    getNoviceMove(state) {
        const options = this.moves(state).filter(([r, c]) => r || c);
        if (!options.length) return [0, 0];
        return options[Math.floor(Math.random() * options.length)];
    },

    // Master: a winning move if there is one; otherwise the move that leaves the most chocolate
    getMasterMove(state) {
        const options = this.moves(state).filter(([r, c]) => r || c);
        if (!options.length) return [0, 0];
        const winning = options.filter(([r, c]) => !this.isWinning(this.eat(state, r, c)));
        if (winning.length) return winning[Math.floor(Math.random() * winning.length)];
        return options.reduce((best, m) => this.squaresLeft(this.eat(state, ...m)) > this.squaresLeft(this.eat(state, ...best)) ? m : best, options[0]);
    }
};
