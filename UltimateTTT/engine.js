/**
 * Ultimate tic-tac-toe: nine small boards in a 3x3 grid. The cell you pick
 * sends the opponent to the small board at that position; a won or full
 * board frees the choice. Win three small boards in a row.
 * cells[b][c]: 0 empty, 1 you (X), 2 the AI (O); won[b]: 0, 1, 2 or 3 (full, no winner)
 */
const UltEngine = {
    LINES: [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]],

    create() {
        return { cells: Array.from({ length: 9 }, () => Array(9).fill(0)), won: Array(9).fill(0), active: null, turn: 1, winner: 0, last: null };
    },

    clone(s) {
        return { cells: s.cells.map(b => [...b]), won: [...s.won], active: s.active, turn: s.turn, winner: s.winner, last: s.last };
    },

    lineWinner(arr) {
        for (const [a, b, c] of this.LINES) if (arr[a] && arr[a] !== 3 && arr[a] === arr[b] && arr[b] === arr[c]) return arr[a];
        return 0;
    },

    moves(s) {
        const out = [];
        const boards = s.active === null ? [0, 1, 2, 3, 4, 5, 6, 7, 8] : [s.active];
        for (const b of boards) { if (s.won[b]) continue; s.cells[b].forEach((v, c) => { if (!v) out.push([b, c]); }); }
        return out;
    },

    apply(s, [b, c]) {
        const n = this.clone(s);
        n.cells[b][c] = s.turn;
        n.last = [b, c];
        if (this.lineWinner(n.cells[b]) === s.turn) n.won[b] = s.turn;
        else if (n.cells[b].every(v => v)) n.won[b] = 3;
        n.winner = this.lineWinner(n.won);
        if (!n.winner && n.won.every(v => v)) n.winner = 3; // draw
        n.active = n.won[c] ? null : c;
        n.turn = 3 - s.turn;
        return n;
    },

    lineScore(arr, p) {
        let score = 0;
        for (const l of this.LINES) {
            const mine = l.filter(i => arr[i] === p).length;
            const theirs = l.filter(i => arr[i] === 3 - p).length;
            const blocked = l.some(i => arr[i] === 3);
            if (theirs || blocked) continue;
            score += [0, 1, 10, 1000][mine];
        }
        return score;
    },

    evaluate(s) {
        if (s.winner === 2) return 100000;
        if (s.winner === 1) return -100000;
        if (s.winner === 3) return 0;
        let score = (this.lineScore(s.won, 2) - this.lineScore(s.won, 1)) * 30;
        for (let b = 0; b < 9; b++) {
            if (s.won[b]) continue;
            const w = b === 4 ? 1.5 : 1;
            score += (this.lineScore(s.cells[b], 2) - this.lineScore(s.cells[b], 1)) * w;
        }
        return score;
    },

    search(s, depth, alpha, beta, deadline) {
        if (s.winner || depth === 0 || Date.now() > deadline) return this.evaluate(s);
        const maximizing = s.turn === 2;
        let best = maximizing ? -Infinity : Infinity;
        for (const m of this.moves(s)) {
            const v = this.search(this.apply(s, m), depth - 1, alpha, beta, deadline);
            if (maximizing) { best = Math.max(best, v); alpha = Math.max(alpha, v); }
            else { best = Math.min(best, v); beta = Math.min(beta, v); }
            if (beta <= alpha) break;
        }
        return best;
    },

    // Iterative deepening up to maxDepth, stopping at a time budget
    getMasterMove(s, maxDepth) {
        const moves = this.moves(s);
        const deadline = Date.now() + 700;
        let best = moves[0];
        for (let depth = 1; depth <= maxDepth; depth++) {
            let bestNow = null;
            for (const m of moves) {
                const v = this.search(this.apply(s, m), depth - 1, -Infinity, Infinity, deadline);
                if (!bestNow || v > bestNow.v) bestNow = { m, v };
            }
            if (Date.now() > deadline) break;
            best = bestNow.m;
            if (bestNow.v >= 100000) break;
        }
        return best;
    },

    getNoviceMove(s) {
        const moves = this.moves(s);
        const win = moves.find(m => { const n = this.apply(s, m); return n.winner === 2 || (n.won[m[0]] === 2 && !s.won[m[0]]); });
        return win || moves[Math.floor(Math.random() * moves.length)];
    }
};
