/**
 * Wythoff's game, shown as "corner the queen". The queen stands on (row, col)
 * with the corner at (0, 0). A move slides her any distance left, up, or
 * diagonally up-left; whoever moves her into the corner wins. The two
 * coordinates are the two piles of Wythoff's Nim.
 * Cold positions (losing for the side to move) are the Wythoff pairs
 * (floor(k*phi), floor(k*phi^2)) in either order.
 */
const WythoffEngine = {
    coldPairs(limit) {
        const cold = new Set(['0,0']);
        const seen = new Set([0]);
        for (let k = 1, a = 0; ; k++) {
            while (seen.has(a)) a++;
            const b = a + k;
            if (a > limit && b > limit) break;
            cold.add(`${a},${b}`);
            cold.add(`${b},${a}`);
            seen.add(a);
            seen.add(b);
        }
        return cold;
    },

    create(level) {
        return { size: level.size, queen: [...level.start], cold: this.coldPairs(level.size) };
    },

    isCold(game, [r, c]) {
        return game.cold.has(`${r},${c}`);
    },

    moves(game) {
        const [r, c] = game.queen;
        const out = [];
        for (let x = 0; x < c; x++) out.push([r, x]);
        for (let x = 0; x < r; x++) out.push([x, c]);
        for (let d = 1; d <= Math.min(r, c); d++) out.push([r - d, c - d]);
        return out;
    },

    isLegal(game, target) {
        return this.moves(game).some(([r, c]) => r === target[0] && c === target[1]);
    },

    getNoviceMove(game) {
        const options = this.moves(game);
        return options[Math.floor(Math.random() * options.length)];
    },

    // Master: move to a cold position when possible, otherwise a random small step
    getMasterMove(game) {
        const options = this.moves(game);
        const winning = options.filter(m => this.isCold(game, m));
        if (winning.length) return winning[0];
        // From a cold position every move loses; nudge one step so the game stays long
        const [r, c] = game.queen;
        const steps = options.filter(([mr, mc]) => Math.max(r - mr, c - mc) === 1);
        return steps[Math.floor(Math.random() * steps.length)];
    }
};
