/**
 * Breakthrough. Each side starts with two rows of pawns. A pawn moves one
 * square straight or diagonally forward into an empty square, and captures
 * only diagonally forward. Reaching the far row wins, as does capturing every
 * enemy pawn. White (the player) moves up the board, black (the AI) down.
 */
const BreakthroughEngine = {
    create(size) {
        const board = Array.from({ length: size }, () => Array(size).fill(null));
        for (let c = 0; c < size; c++) {
            board[0][c] = 'black'; board[1][c] = 'black';
            board[size - 1][c] = 'white'; board[size - 2][c] = 'white';
        }
        return board;
    },

    other(color) {
        return color === 'white' ? 'black' : 'white';
    },

    forward(color) {
        return color === 'white' ? -1 : 1;
    },

    moves(board, color) {
        const n = board.length;
        const dr = this.forward(color);
        const out = [];
        for (let r = 0; r < n; r++) {
            for (let c = 0; c < n; c++) {
                if (board[r][c] !== color) continue;
                const nr = r + dr;
                if (nr < 0 || nr >= n) continue;
                for (const dc of [-1, 0, 1]) {
                    const nc = c + dc;
                    if (nc < 0 || nc >= n) continue;
                    const target = board[nr][nc];
                    if (target === color) continue;
                    if (dc === 0 && target) continue; // straight moves never capture
                    out.push({ from: [r, c], to: [nr, nc], capture: !!target });
                }
            }
        }
        return out;
    },

    apply(board, move) {
        const next = board.map(row => [...row]);
        next[move.to[0]][move.to[1]] = next[move.from[0]][move.from[1]];
        next[move.from[0]][move.from[1]] = null;
        return next;
    },

    // The winner, if any: a pawn on the far row, or an opponent with no pawns
    winner(board) {
        const n = board.length;
        if (board[0].includes('white')) return 'white';
        if (board[n - 1].includes('black')) return 'black';
        const flat = board.flat();
        if (!flat.includes('black')) return 'white';
        if (!flat.includes('white')) return 'black';
        return null;
    },

    // Position value from `color`'s point of view
    evaluate(board, color) {
        const n = board.length;
        let score = 0;
        for (let r = 0; r < n; r++) {
            for (let c = 0; c < n; c++) {
                const p = board[r][c];
                if (!p) continue;
                const advance = p === 'white' ? n - 1 - r : r;
                let value = 10 + advance * advance * 0.5;
                if (advance === n - 2) value += 12; // one step from breaking through
                score += p === color ? value : -value;
            }
        }
        return score;
    },

    search(board, color, depth, alpha, beta, root, deadline) {
        const win = this.winner(board);
        if (win) return (win === root ? 1 : -1) * (10000 + depth);
        if (depth === 0) return this.evaluate(board, root);
        const moves = this.moves(board, color);
        if (!moves.length) return color === root ? -9000 : 9000;
        // captures and advances first for better pruning
        moves.sort((a, b) => (b.capture - a.capture) || (a.to[0] - b.to[0]) * (color === 'white' ? 1 : -1));
        const maximizing = color === root;
        let best = maximizing ? -Infinity : Infinity;
        for (const move of moves) {
            if (performance.now() > deadline) throw new Error('timeout');
            const value = this.search(this.apply(board, move), this.other(color), depth - 1, alpha, beta, root, deadline);
            if (maximizing) { best = Math.max(best, value); alpha = Math.max(alpha, value); }
            else { best = Math.min(best, value); beta = Math.min(beta, value); }
            if (beta <= alpha) break;
        }
        return best;
    },

    bestMove(board, color, depth, budgetMs) {
        const moves = this.moves(board, color);
        if (!moves.length) return null;
        const deadline = performance.now() + budgetMs;
        let best = moves[Math.floor(Math.random() * moves.length)];
        for (let d = 1; d <= depth; d++) {
            try {
                let bestValue = -Infinity;
                let bestMove = best;
                for (const move of moves) {
                    const value = this.search(this.apply(board, move), this.other(color), d - 1, -Infinity, Infinity, color, deadline) + Math.random() * 0.01;
                    if (value > bestValue) { bestValue = value; bestMove = move; }
                }
                best = bestMove;
            } catch (e) {
                break;
            }
        }
        return best;
    },

    getNoviceMove(board, color) {
        return this.bestMove(board, color, 2, 200);
    },

    getMasterMove(board, color, depth = 5) {
        return this.bestMove(board, color, depth, 700);
    }
};
