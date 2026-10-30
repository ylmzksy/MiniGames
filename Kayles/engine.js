/**
 * Kayles. A row of pins; a move knocks down one pin or two pins standing next
 * to each other. Whoever knocks down the last pin wins.
 * State: array of booleans, true = standing. Strategy comes from the
 * Sprague-Grundy values of the runs of standing pins.
 */
const KaylesEngine = {
    create(level) {
        return [...level.pins].map(ch => ch === '|');
    },

    standing(state) {
        return state.filter(Boolean).length;
    },

    // Moves as [index] or [index, index + 1]
    moves(state) {
        const out = [];
        state.forEach((up, i) => {
            if (!up) return;
            out.push([i]);
            if (state[i + 1]) out.push([i, i + 1]);
        });
        return out;
    },

    isLegal(state, move) {
        return move.every(i => state[i]) && (move.length === 1 || move[1] === move[0] + 1);
    },

    apply(state, move) {
        const next = [...state];
        move.forEach(i => { next[i] = false; });
        return next;
    },

    // Lengths of the runs of standing pins
    runs(state) {
        const out = [];
        let len = 0;
        state.forEach(up => {
            if (up) len++;
            else if (len) { out.push(len); len = 0; }
        });
        if (len) out.push(len);
        return out;
    },

    grundy(n, memo = this.memo || (this.memo = [0])) {
        if (memo[n] !== undefined) return memo[n];
        const seen = new Set();
        for (let i = 0; i < n; i++) seen.add(this.grundy(i, memo) ^ this.grundy(n - 1 - i, memo));
        for (let i = 0; i + 2 <= n; i++) seen.add(this.grundy(i, memo) ^ this.grundy(n - 2 - i, memo));
        let g = 0;
        while (seen.has(g)) g++;
        memo[n] = g;
        return g;
    },

    value(state) {
        return this.runs(state).reduce((x, n) => x ^ this.grundy(n), 0);
    },

    getNoviceMove(state) {
        const options = this.moves(state);
        return options[Math.floor(Math.random() * options.length)];
    },

    // Master: a move that leaves a zero position; otherwise a single pin, to keep the game long
    getMasterMove(state) {
        const options = this.moves(state);
        const winning = options.filter(m => this.value(this.apply(state, m)) === 0);
        if (winning.length) return winning[Math.floor(Math.random() * winning.length)];
        const singles = options.filter(m => m.length === 1);
        return singles[Math.floor(Math.random() * singles.length)];
    }
};
