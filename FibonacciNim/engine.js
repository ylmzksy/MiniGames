/**
 * Fibonacci Nim. One pile of coins. The first player may take any number
 * but not the whole pile; after that a player may take at most twice as
 * many as the previous player took. Whoever takes the last coin wins.
 * The winning strategy uses the Zeckendorf representation of the pile:
 * take its smallest Fibonacci part when the limit allows it.
 */
const FibonacciEngine = {
    create(level) {
        return { pile: level.coins, limit: level.coins - 1, lastTake: null };
    },

    maxTake(state) {
        return Math.min(state.pile, state.limit);
    },

    apply(state, n) {
        return { pile: state.pile - n, limit: 2 * n, lastTake: n };
    },

    fibonacci(upTo) {
        const fib = [1, 2];
        while (fib[fib.length - 1] <= upTo) fib.push(fib[fib.length - 1] + fib[fib.length - 2]);
        return fib;
    },

    // Zeckendorf parts of n, largest first
    zeckendorf(n) {
        const fib = this.fibonacci(n).filter(f => f <= n).reverse();
        const parts = [];
        let rest = n;
        fib.forEach(f => { if (f <= rest) { parts.push(f); rest -= f; } });
        return parts;
    },

    getNoviceMove(state) {
        const max = this.maxTake(state);
        if (state.pile <= state.limit) return state.pile; // take the lot and win
        return 1 + Math.floor(Math.random() * max);
    },

    getMasterMove(state) {
        const max = this.maxTake(state);
        if (state.pile <= state.limit) return state.pile;
        const parts = this.zeckendorf(state.pile);
        const smallest = parts[parts.length - 1];
        if (smallest <= max) return smallest;
        return 1; // losing position: take as little as possible
    }
};
