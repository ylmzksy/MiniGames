/**
 * Hex on an n x n rhombus of hexagons. Blue (the player) connects the left
 * and right edges, red (the AI) connects the top and bottom. Cell (r, c) has
 * neighbors (r-1,c), (r-1,c+1), (r,c-1), (r,c+1), (r+1,c-1), (r+1,c).
 * The AI judges a position by shortest-path distance: how many more stones
 * each side needs to connect its edges, found with Dijkstra over empty cells.
 */
const HexEngine = {
    neighborOffsets: [[-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0]],

    create(size) {
        return { size, cells: Array.from({ length: size }, () => Array(size).fill(null)) };
    },

    clone(board) {
        return { size: board.size, cells: board.cells.map(row => [...row]) };
    },

    neighbors(board, r, c) {
        return this.neighborOffsets
            .map(([dr, dc]) => [r + dr, c + dc])
            .filter(([nr, nc]) => nr >= 0 && nc >= 0 && nr < board.size && nc < board.size);
    },

    empties(board) {
        const out = [];
        board.cells.forEach((row, r) => row.forEach((v, c) => { if (!v) out.push([r, c]); }));
        return out;
    },

    // Stones still needed by `color` to connect its edges (0 = connected), plus the
    // cells of one shortest path, so a finished game can show the winning chain
    distance(board, color) {
        const n = board.size;
        const dist = Array.from({ length: n }, () => Array(n).fill(Infinity));
        const prev = Array.from({ length: n }, () => Array(n).fill(null));
        const cost = (r, c) => board.cells[r][c] === color ? 0 : board.cells[r][c] === null ? 1 : Infinity;
        const isStart = (r, c) => color === 'red' ? r === 0 : c === 0;
        const isEnd = (r, c) => color === 'red' ? r === n - 1 : c === n - 1;

        const queue = [];
        for (let i = 0; i < n; i++) {
            const [r, c] = color === 'red' ? [0, i] : [i, 0];
            const d = cost(r, c);
            if (d < Infinity) { dist[r][c] = d; queue.push([d, r, c]); }
        }
        const done = Array.from({ length: n }, () => Array(n).fill(false));
        while (queue.length) {
            queue.sort((a, b) => a[0] - b[0]);
            const [d, r, c] = queue.shift();
            if (done[r][c]) continue;
            done[r][c] = true;
            if (isEnd(r, c)) {
                const path = [];
                for (let cur = [r, c]; cur; cur = prev[cur[0]][cur[1]]) path.push(cur);
                return { distance: d, path };
            }
            this.neighbors(board, r, c).forEach(([nr, nc]) => {
                const nd = d + cost(nr, nc);
                if (nd < dist[nr][nc]) {
                    dist[nr][nc] = nd;
                    prev[nr][nc] = [r, c];
                    queue.push([nd, nr, nc]);
                }
            });
        }
        return { distance: Infinity, path: [] };
    },

    winner(board) {
        if (this.distance(board, 'red').distance === 0) return 'red';
        if (this.distance(board, 'blue').distance === 0) return 'blue';
        return null;
    },

    // Position value from red's point of view, with a tiny pull toward the center
    evaluate(board) {
        return this.distance(board, 'blue').distance - this.distance(board, 'red').distance;
    },

    centrality(board, r, c) {
        const mid = (board.size - 1) / 2;
        return -(Math.abs(r - mid) + Math.abs(c - mid)) * 0.01;
    },

    // Novice: looks one move ahead. A clearly best move (a win, or a block that
    // costs blue a stone) is always taken; otherwise one of the best few at random
    getNoviceMove(board) {
        const scored = this.empties(board).map(([r, c]) => {
            const next = this.clone(board);
            next.cells[r][c] = 'red';
            return { move: [r, c], score: this.evaluate(next) + this.centrality(board, r, c) };
        }).sort((a, b) => (b.score > a.score) - (b.score < a.score));
        // Scores differ by whole stones plus tiny centrality nudges, so half a stone is a clear margin
        if (scored.length === 1 || scored[0].score >= scored[1].score + 0.5) return scored[0].move;
        const top = scored.slice(0, Math.min(3, scored.length));
        return top[Math.floor(Math.random() * top.length)].move;
    },

    // Master: two plies deep, assuming blue answers with its own best move
    getMasterMove(board) {
        let best = null;
        const empties = this.empties(board);
        for (const [r, c] of empties) {
            const next = this.clone(board);
            next.cells[r][c] = 'red';
            if (this.distance(next, 'red').distance === 0) return [r, c];
            let worst = Infinity;
            for (const [pr, pc] of empties) {
                if (pr === r && pc === c) continue;
                const reply = this.clone(next);
                reply.cells[pr][pc] = 'blue';
                const value = this.evaluate(reply);
                if (value < worst) worst = value;
                if (worst < (best?.score ?? -Infinity)) break; // cannot beat the best line anymore
            }
            const score = worst + this.centrality(board, r, c);
            if (!best || score > best.score) best = { move: [r, c], score };
        }
        return best.move;
    }
};
