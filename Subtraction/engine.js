/**
 * Subtraction game. One pile of counters; each turn you take one of the
 * allowed amounts. Normally whoever takes the last counter wins; in the
 * misère variant whoever takes the last counter loses. A player who has no
 * legal take loses. Perfect play comes from a win/loss table.
 */
const SubtractionEngine = {
    create(level) {
        return { pile: level.counters, takes: [...level.takes].sort((a, b) => a - b), misere: !!level.misere };
    },

    options(state) {
        return state.takes.filter(t => t <= state.pile);
    },

    apply(state, n) {
        return { ...state, pile: state.pile - n };
    },

    // table[k] = true when the player to move with k counters can force a win
    table(state) {
        const key = `${state.takes.join(',')}|${state.misere}`;
        this.memo = this.memo || {};
        if (this.memo[key] && this.memo[key].length > state.pile) return this.memo[key];
        const win = [];
        for (let k = 0; k <= Math.max(state.pile, 1); k++) {
            if (k === 0) { win[k] = state.misere; continue; } // misère: the previous player took the last and lost
            const moves = state.takes.filter(t => t <= k);
            win[k] = moves.some(t => !win[k - t]);
        }
        this.memo[key] = win;
        return win;
    },

    isWinning(state) {
        return this.table(state)[state.pile];
    },

    // A take after which the opponent has lost at once: the pile is empty (normal play),
    // or in misère play the opponent is forced to take the last counter or cannot move
    finisher(state) {
        const win = this.table(state);
        const minTake = Math.min(...state.takes);
        return this.options(state).find(t => {
            const rest = state.pile - t;
            return state.misere ? (rest > 0 && rest <= minTake && !win[rest]) : rest === 0;
        }) ?? null;
    },

    getNoviceMove(state) {
        const options = this.options(state);
        const f = this.finisher(state);
        if (f !== null) return f;
        return options[Math.floor(Math.random() * options.length)];
    },

    getMasterMove(state) {
        const options = this.options(state);
        const win = this.table(state);
        const good = options.filter(t => !win[state.pile - t]);
        if (good.length) return good[Math.floor(Math.random() * good.length)];
        return options[Math.floor(Math.random() * options.length)];
    }
};
