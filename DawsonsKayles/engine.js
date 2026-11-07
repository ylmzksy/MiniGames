/**
 * Dawson's Kayles. A row of pins; a move knocks down exactly two pins that
 * stand next to each other. Whoever makes the last move wins.
 * State: array of booleans, true = standing. Strategy from the Sprague-Grundy
 * values of the runs of standing pins.
 */
const DawsonEngine = {
    create(level) {
        return [...level.pins].map(ch => ch === '|');
    },

    standing(state) {
        return state.filter(Boolean).length;
    },

    // Moves as [index, index + 1]
    moves(state) {
        const out = [];
        state.forEach((up, i) => { if (up && state[i + 1]) out.push([i, i + 1]); });
        return out;
    },

    isLegal(state, move) {
        return move.length === 2 && move[1] === move[0] + 1 && state[move[0]] && state[move[1]];
    },

    apply(state, move) {
        const next = [...state];
        move.forEach(i => { next[i] = false; });
        return next;
    },

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

    grundy(n, memo = this.memo || (this.memo = [0, 0])) {
        if (memo[n] !== undefined) return memo[n];
        const seen = new Set();
        for (let i = 0; i + 2 <= n; i++) seen.add(this.grundy(i, memo) ^ this.grundy(n - 2 - i, memo));
        let g = 0;
        while (seen.has(g)) g++;
        memo[n] = g;
        return g;
    },

    value(state) {
        return this.runs(state).reduce((x, n) => x ^ this.grundy(n), 0);
    },

    // Novice: random, but takes a move that ends the game
    getNoviceMove(state) {
        const options = this.moves(state);
        const finisher = options.find(m => this.moves(this.apply(state, m)).length === 0);
        if (finisher) return finisher;
        return options[Math.floor(Math.random() * options.length)];
    },

    getMasterMove(state) {
        const options = this.moves(state);
        const winning = options.filter(m => this.value(this.apply(state, m)) === 0);
        if (winning.length) return winning[Math.floor(Math.random() * winning.length)];
        return options[Math.floor(Math.random() * options.length)];
    }
};
