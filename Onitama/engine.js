/**
 * Onitama. Blue (the player) starts at the bottom and moves up; red (the AI)
 * starts at the top. Each side has a master and four students. A move uses
 * one of the mover's two cards: the piece moves by one of the card's offsets
 * (dx, dy), where dy is forward from the mover's point of view. The used card
 * goes to the middle and the middle card comes to the mover.
 * Win by capturing the enemy master, or by moving your master onto the
 * enemy temple (the center of their back row).
 */
const OnitamaEngine = {
    cards: {
        tiger: [[0, 2], [0, -1]],
        dragon: [[-2, 1], [2, 1], [-1, -1], [1, -1]],
        frog: [[-2, 0], [-1, 1], [1, -1]],
        rabbit: [[2, 0], [1, 1], [-1, -1]],
        crab: [[0, 1], [-2, 0], [2, 0]],
        elephant: [[-1, 1], [1, 1], [-1, 0], [1, 0]],
        goose: [[-1, 1], [-1, 0], [1, 0], [1, -1]],
        rooster: [[1, 1], [1, 0], [-1, 0], [-1, -1]],
        monkey: [[-1, 1], [1, 1], [-1, -1], [1, -1]],
        mantis: [[-1, 1], [1, 1], [0, -1]],
        horse: [[0, 1], [-1, 0], [0, -1]],
        ox: [[0, 1], [1, 0], [0, -1]],
        crane: [[0, 1], [-1, -1], [1, -1]],
        boar: [[0, 1], [-1, 0], [1, 0]],
        eel: [[-1, 1], [-1, -1], [1, 0]],
        cobra: [[-1, 0], [1, 1], [1, -1]]
    },

    temple: { blue: [4, 2], red: [0, 2] },

    // level.cards: [blue card, blue card, red card, red card, middle card]
    create(level) {
        const board = Array.from({ length: 5 }, () => Array(5).fill(null));
        for (let c = 0; c < 5; c++) {
            board[0][c] = { owner: 'red', type: c === 2 ? 'master' : 'student' };
            board[4][c] = { owner: 'blue', type: c === 2 ? 'master' : 'student' };
        }
        const [b1, b2, r1, r2, middle] = level.cards;
        return { board, cards: { blue: [b1, b2], red: [r1, r2], middle }, turn: 'blue', winner: null };
    },

    clone(state) {
        return {
            board: state.board.map(row => row.map(p => p && { ...p })),
            cards: { blue: [...state.cards.blue], red: [...state.cards.red], middle: state.cards.middle },
            turn: state.turn,
            winner: state.winner
        };
    },

    // Board offset of a card move for the given side
    offset(owner, [dx, dy]) {
        return owner === 'blue' ? [-dy, dx] : [dy, -dx];
    },

    other(owner) {
        return owner === 'blue' ? 'red' : 'blue';
    },

    // All legal moves for the side to move; with no legal move, each card can be passed
    moves(state, owner = state.turn) {
        const out = [];
        state.cards[owner].forEach(card => {
            state.board.forEach((row, r) => row.forEach((piece, c) => {
                if (!piece || piece.owner !== owner) return;
                this.cards[card].forEach(step => {
                    const [dr, dc] = this.offset(owner, step);
                    const nr = r + dr;
                    const nc = c + dc;
                    if (nr < 0 || nc < 0 || nr > 4 || nc > 4) return;
                    if (state.board[nr][nc]?.owner === owner) return;
                    out.push({ card, from: [r, c], to: [nr, nc] });
                });
            }));
        });
        if (!out.length) state.cards[owner].forEach(card => out.push({ card, pass: true }));
        return out;
    },

    apply(state, move) {
        const next = this.clone(state);
        const owner = state.turn;
        if (!move.pass) {
            const [r, c] = move.from;
            const [nr, nc] = move.to;
            const piece = next.board[r][c];
            const captured = next.board[nr][nc];
            next.board[nr][nc] = piece;
            next.board[r][c] = null;
            if (captured?.type === 'master') next.winner = owner;
            const enemyTemple = this.temple[this.other(owner)];
            if (piece.type === 'master' && nr === enemyTemple[0] && nc === enemyTemple[1]) next.winner = owner;
        }
        // Card rotation: the used card goes to the middle, the middle card to the mover
        const hand = next.cards[owner];
        hand[hand.indexOf(move.card)] = next.cards.middle;
        next.cards.middle = move.card;
        next.turn = this.other(owner);
        return next;
    },

    // Position value from red's point of view
    evaluate(state) {
        if (state.winner) return state.winner === 'red' ? 10000 : -10000;
        let score = 0;
        state.board.forEach((row, r) => row.forEach((piece, c) => {
            if (!piece) return;
            const sign = piece.owner === 'red' ? 1 : -1;
            if (piece.type === 'student') score += sign * 10;
            // Masters are drawn toward the enemy temple, every piece a little toward the center
            if (piece.type === 'master') {
                const [tr, tc] = this.temple[this.other(piece.owner)];
                score -= sign * (Math.abs(tr - r) + Math.abs(tc - c)) * 0.5;
            }
            score += sign * (2 - Math.max(Math.abs(r - 2), Math.abs(c - 2))) * 0.3;
        }));
        return score;
    },

    search(state, depth, alpha, beta) {
        if (state.winner || depth === 0) return this.evaluate(state);
        const maximizing = state.turn === 'red';
        let best = maximizing ? -Infinity : Infinity;
        for (const move of this.moves(state)) {
            const value = this.search(this.apply(state, move), depth - 1, alpha, beta);
            if (maximizing) {
                best = Math.max(best, value);
                alpha = Math.max(alpha, value);
            } else {
                best = Math.min(best, value);
                beta = Math.min(beta, value);
            }
            if (beta <= alpha) break;
        }
        return best;
    },

    scoredMoves(state, depth) {
        return this.moves(state)
            .map(move => ({ move, score: this.search(this.apply(state, move), depth - 1, -Infinity, Infinity) }))
            .sort((a, b) => (b.score > a.score) - (b.score < a.score));
    },

    // Novice: one move ahead, with the reply considered; near-ties are picked at random
    getNoviceMove(state) {
        const scored = this.scoredMoves(state, 2);
        if (scored.length === 1 || scored[0].score >= scored[1].score + 5) return scored[0].move;
        const top = scored.slice(0, Math.min(3, scored.length));
        return top[Math.floor(Math.random() * top.length)].move;
    },

    // Master: four plies of alpha-beta search
    getMasterMove(state) {
        const scored = this.scoredMoves(state, 4);
        const best = scored.filter(s => s.score === scored[0].score);
        return best[Math.floor(Math.random() * best.length)].move;
    }
};
