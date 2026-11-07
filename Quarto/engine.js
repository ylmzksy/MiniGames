/**
 * Quarto. Sixteen pieces, each a unique mix of four traits: tall or short,
 * dark or light, round or square, hollow or solid. On a turn you place the
 * piece your opponent handed you, then hand your opponent one of the
 * remaining pieces. Four in a row, column or diagonal sharing any trait
 * wins. A full board without such a line is a draw.
 * A piece is a number 0..15; each bit is one trait.
 */
const QuartoEngine = {
    lines: (() => {
        const L = [];
        for (let i = 0; i < 4; i++) {
            L.push([0, 1, 2, 3].map(j => i * 4 + j));
            L.push([0, 1, 2, 3].map(j => j * 4 + i));
        }
        L.push([0, 5, 10, 15]);
        L.push([3, 6, 9, 12]);
        return L;
    })(),

    create() {
        return { board: Array(16).fill(null), remaining: Array.from({ length: 16 }, (_, i) => i) };
    },

    // Cells of a completed line sharing a trait, or null
    winningLine(board) {
        for (const line of this.lines) {
            const pieces = line.map(i => board[i]);
            if (pieces.some(p => p === null)) continue;
            const all = pieces.reduce((a, p) => a & p, 15);
            const none = pieces.reduce((a, p) => a & (~p & 15), 15);
            if (all || none) return line;
        }
        return null;
    },

    isFull(board) {
        return board.every(p => p !== null);
    },

    place(state, cell, piece) {
        const board = [...state.board];
        board[cell] = piece;
        return { board, remaining: state.remaining.filter(p => p !== piece) };
    },

    // True when `piece` can be placed somewhere to win
    canWinWith(board, piece) {
        return board.some((p, cell) => {
            if (p !== null) return false;
            const b = [...board];
            b[cell] = piece;
            return this.winningLine(b) !== null;
        });
    },

    winningCell(board, piece) {
        for (let cell = 0; cell < 16; cell++) {
            if (board[cell] !== null) continue;
            const b = [...board];
            b[cell] = piece;
            if (this.winningLine(b)) return cell;
        }
        return -1;
    },

    // Value of handing `piece` to the opponent on `board`, from the giver's view;
    // depth counts full plies (place + give) of lookahead
    giveValue(state, piece, depth, deadline) {
        if (performance.now() > deadline) throw new Error('timeout');
        if (this.canWinWith(state.board, piece)) return -1;
        const empties = state.board.map((p, i) => p === null ? i : -1).filter(i => i >= 0);
        if (empties.length === 1 || depth === 0 || !state.remaining.length) return 0;
        // the opponent places the piece, then gives us one: we see our best response
        let worst = 1;
        for (const cell of empties) {
            const next = this.place(state, cell, piece);
            next.board[cell] = piece;
            const rest = next.remaining.filter(p => p !== piece);
            let bestGive = -1;
            for (const give of rest) {
                const v = -this.giveValue({ board: next.board, remaining: rest }, give, depth - 1, deadline);
                if (v > bestGive) bestGive = v;
                if (bestGive === 1) break;
            }
            if (!rest.length) bestGive = 0;
            // the opponent picks the placement that is worst for us (value from our view is -bestGive... keep signs: value for giver)
            const forGiver = -bestGive;
            if (forGiver < worst) worst = forGiver;
            if (worst === -1) break;
        }
        return worst;
    },

    // Chooses where to put `piece` and which piece to hand over next
    getMove(state, piece, difficulty, maxDepth) {
        const empties = state.board.map((p, i) => p === null ? i : -1).filter(i => i >= 0);
        const win = this.winningCell(state.board, piece);
        if (win >= 0) return { cell: win, give: null };
        const deadline = performance.now() + 700;
        const options = [];
        for (const cell of empties) {
            const next = this.place(state, cell, piece);
            next.board[cell] = piece;
            const rest = next.remaining.filter(p => p !== piece);
            if (!rest.length) { options.push({ cell, give: null, value: 0 }); continue; }
            for (const give of rest) {
                let value;
                if (difficulty === 'novice') {
                    value = this.canWinWith(next.board, give) ? -1 : 0;
                } else {
                    try { value = this.giveValue({ board: next.board, remaining: rest }, give, maxDepth, deadline); }
                    catch (e) { value = this.canWinWith(next.board, give) ? -1 : 0; }
                }
                options.push({ cell, give, value });
            }
        }
        const best = Math.max(...options.map(o => o.value));
        const top = options.filter(o => o.value === best);
        return top[Math.floor(Math.random() * top.length)];
    }
};
