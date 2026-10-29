/**
 * Mastermind rules. A secret code of `length` colors (indices 0..colors-1) is
 * drawn at random; each guess is scored with black pegs (right color in the
 * right place) and white pegs (right color in the wrong place).
 */
const MastermindEngine = {
    generateCode(length, colors, allowDuplicates) {
        const pool = Array.from({ length: colors }, (_, i) => i);
        const code = [];
        for (let i = 0; i < length; i++) {
            const idx = Math.floor(Math.random() * pool.length);
            code.push(allowDuplicates ? pool[idx] : pool.splice(idx, 1)[0]);
        }
        return code;
    },

    score(secret, guess) {
        let black = 0;
        const secretLeft = [];
        const guessLeft = [];
        secret.forEach((color, i) => {
            if (guess[i] === color) {
                black++;
            } else {
                secretLeft.push(color);
                guessLeft.push(guess[i]);
            }
        });

        // Whites: colors present in both leftovers, counted with multiplicity
        let white = 0;
        guessLeft.forEach(color => {
            const idx = secretLeft.indexOf(color);
            if (idx >= 0) {
                white++;
                secretLeft.splice(idx, 1);
            }
        });
        return { black, white };
    },

    isComplete(guess) {
        return guess.every(color => color !== null);
    }
};
