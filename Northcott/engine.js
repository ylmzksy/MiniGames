/**
 * Northcott's game. Every row holds one blue checker (you) and one red
 * checker (the AI). A move slides one of your checkers along its row any
 * number of free squares, never jumping over the other checker. Whoever
 * cannot move loses. It is Nim in disguise: each row's gap between the two
 * checkers is a pile, since the opponent can always undo a move away.
 * State: { width, rows: [{ blue, red }] } with column indices.
 */
const NorthcottEngine = {
    create(level) {
        return { width: level.width, rows: level.rows.map(r => ({ blue: r[0], red: r[1] })) };
    },

    clone(state) {
        return { width: state.width, rows: state.rows.map(r => ({ ...r })) };
    },

    gap(row) {
        return Math.abs(row.blue - row.red) - 1;
    },

    value(state) {
        return state.rows.reduce((x, row) => x ^ this.gap(row), 0);
    },

    // Squares a checker may slide to: between the wall and the other checker
    targets(state, r, color) {
        const row = state.rows[r];
        const mine = row[color];
        const other = color === 'blue' ? row.red : row.blue;
        const out = [];
        const lo = other < mine ? other + 1 : 0;
        const hi = other > mine ? other - 1 : state.width - 1;
        for (let c = lo; c <= hi; c++) if (c !== mine) out.push(c);
        return out;
    },

    moves(state, color) {
        return state.rows.flatMap((_, r) => this.targets(state, r, color).map(c => ({ row: r, to: c })));
    },

    apply(state, color, move) {
        const next = this.clone(state);
        next.rows[move.row][color] = move.to;
        return next;
    },

    // Novice: random, but ends the game at once when it can
    getNoviceMove(state, color) {
        const options = this.moves(state, color);
        const other = color === 'blue' ? 'red' : 'blue';
        const finisher = options.find(m => this.moves(this.apply(state, color, m), other).length === 0);
        if (finisher) return finisher;
        return options[Math.floor(Math.random() * options.length)];
    },

    // Master: close a gap to make the XOR zero; from a lost position, widen a gap to prolong
    getMasterMove(state, color) {
        const options = this.moves(state, color);
        const winning = options.filter(m => this.value(this.apply(state, color, m)) === 0 && this.gap(this.apply(state, color, m).rows[m.row]) < this.gap(state.rows[m.row]));
        if (winning.length) return winning[Math.floor(Math.random() * winning.length)];
        const widening = options.filter(m => this.gap(this.apply(state, color, m).rows[m.row]) > this.gap(state.rows[m.row]));
        const pool = widening.length ? widening : options;
        return pool[Math.floor(Math.random() * pool.length)];
    }
};
