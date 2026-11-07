/**
 * Othello (Reversi). Black (the player) and white (the AI) take turns placing
 * discs; a move must flank enemy discs in a straight line, which then flip.
 * A side with no legal move passes; the game ends when neither can move, and
 * the side with more discs wins.
 */
const OthelloEngine = {
    directions: [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]],

    create(size) {
        const board = Array.from({ length: size }, () => Array(size).fill(null));
        const m = size / 2;
        board[m - 1][m - 1] = 'white';
        board[m][m] = 'white';
        board[m - 1][m] = 'black';
        board[m][m - 1] = 'black';
        return board;
    },

    other(color) {
        return color === 'black' ? 'white' : 'black';
    },

    // Discs flipped by playing (r, c) as color, empty when the move is illegal
    flips(board, r, c, color) {
        if (board[r][c]) return [];
        const n = board.length;
        const out = [];
        for (const [dr, dc] of this.directions) {
            const line = [];
            let nr = r + dr;
            let nc = c + dc;
            while (nr >= 0 && nc >= 0 && nr < n && nc < n && board[nr][nc] === this.other(color)) {
                line.push([nr, nc]);
                nr += dr;
                nc += dc;
            }
            if (line.length && nr >= 0 && nc >= 0 && nr < n && nc < n && board[nr][nc] === color) out.push(...line);
        }
        return out;
    },

    legalMoves(board, color) {
        const moves = [];
        for (let r = 0; r < board.length; r++) {
            for (let c = 0; c < board.length; c++) {
                const f = this.flips(board, r, c, color);
                if (f.length) moves.push({ r, c, flips: f });
            }
        }
        return moves;
    },

    apply(board, move, color) {
        const next = board.map(row => [...row]);
        next[move.r][move.c] = color;
        move.flips.forEach(([r, c]) => { next[r][c] = color; });
        return next;
    },

    count(board, color) {
        return board.flat().filter(v => v === color).length;
    },

    empties(board) {
        return board.flat().filter(v => !v).length;
    },

    isOver(board) {
        return !this.legalMoves(board, 'black').length && !this.legalMoves(board, 'white').length;
    },

    // Square weights: corners are gold, the squares next to them are poison
    weights(n) {
        const w = Array.from({ length: n }, () => Array(n).fill(1));
        const corners = [[0, 0], [0, n - 1], [n - 1, 0], [n - 1, n - 1]];
        for (let i = 0; i < n; i++) { w[0][i] = w[n - 1][i] = w[i][0] = w[i][n - 1] = 8; }
        corners.forEach(([r, c]) => {
            const dr = r === 0 ? 1 : -1;
            const dc = c === 0 ? 1 : -1;
            w[r][c + dc] = w[r + dr][c] = -15;
            w[r + dr][c + dc] = -40;
            w[r][c] = 100;
        });
        return w;
    },

    evaluate(board, color, weights) {
        const me = color;
        const you = this.other(color);
        if (this.empties(board) <= 10 || this.isOver(board)) {
            return (this.count(board, me) - this.count(board, you)) * 100;
        }
        let score = 0;
        for (let r = 0; r < board.length; r++) {
            for (let c = 0; c < board.length; c++) {
                if (board[r][c] === me) score += weights[r][c];
                else if (board[r][c] === you) score -= weights[r][c];
            }
        }
        return score + 4 * (this.legalMoves(board, me).length - this.legalMoves(board, you).length);
    },

    search(board, color, depth, alpha, beta, root, weights, deadline) {
        const moves = this.legalMoves(board, color);
        if (depth === 0 || (!moves.length && !this.legalMoves(board, this.other(color)).length)) {
            return this.evaluate(board, root, weights);
        }
        if (!moves.length) return this.search(board, this.other(color), depth - 1, alpha, beta, root, weights, deadline);
        const maximizing = color === root;
        let best = maximizing ? -Infinity : Infinity;
        for (const move of moves) {
            if (performance.now() > deadline) throw new Error('timeout');
            const value = this.search(this.apply(board, move, color), this.other(color), depth - 1, alpha, beta, root, weights, deadline);
            if (maximizing) { best = Math.max(best, value); alpha = Math.max(alpha, value); }
            else { best = Math.min(best, value); beta = Math.min(beta, value); }
            if (beta <= alpha) break;
        }
        return best;
    },

    getNoviceMove(board, color) {
        const moves = this.legalMoves(board, color);
        if (!moves.length) return null;
        moves.sort((a, b) => b.flips.length - a.flips.length);
        const top = moves.slice(0, Math.min(3, moves.length));
        return top[Math.floor(Math.random() * top.length)];
    },

    // Master: iterative deepening alpha-beta within a time budget; exact in the endgame
    getMasterMove(board, color, maxDepth = 6, budgetMs = 700) {
        const moves = this.legalMoves(board, color);
        if (!moves.length) return null;
        const weights = this.weights(board.length);
        const deadline = performance.now() + budgetMs;
        const limit = this.empties(board) <= 10 ? this.empties(board) : maxDepth;
        let best = moves[0];
        for (let depth = 1; depth <= limit; depth++) {
            try {
                let bestValue = -Infinity;
                let bestMove = best;
                for (const move of moves) {
                    const value = this.search(this.apply(board, move, color), this.other(color), depth - 1, -Infinity, Infinity, color, weights, deadline);
                    if (value > bestValue) { bestValue = value; bestMove = move; }
                }
                best = bestMove;
            } catch (e) {
                break;
            }
        }
        return best;
    }
};
