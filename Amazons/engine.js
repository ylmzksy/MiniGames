/**
 * Game of the Amazons. Each side has amazons on an n x n board. A move:
 * pick one of your amazons, slide it like a chess queen through empty
 * squares, then from its new square shoot an arrow like a queen onto an
 * empty square, which is blocked for the rest of the game. The player who
 * cannot move loses.
 * Cells: 0 empty, 1 player's amazon, 2 AI's amazon, 3 arrow.
 */
const AmazonsEngine = {
    directions: [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1], [1, -1], [1, 1]],

    create(level) {
        const n = level.size;
        const cells = Array.from({ length: n }, () => Array(n).fill(0));
        level.player.forEach(([r, c]) => { cells[r][c] = 1; });
        level.ai.forEach(([r, c]) => { cells[r][c] = 2; });
        return { size: n, cells };
    },

    clone(state) {
        return { size: state.size, cells: state.cells.map(row => [...row]) };
    },

    // Squares reachable with queen moves from (r, c) through empty squares
    reach(state, r, c) {
        const out = [];
        for (const [dr, dc] of this.directions) {
            let nr = r + dr;
            let nc = c + dc;
            while (nr >= 0 && nc >= 0 && nr < state.size && nc < state.size && state.cells[nr][nc] === 0) {
                out.push([nr, nc]);
                nr += dr;
                nc += dc;
            }
        }
        return out;
    },

    amazons(state, side) {
        const out = [];
        state.cells.forEach((row, r) => row.forEach((v, c) => { if (v === side) out.push([r, c]); }));
        return out;
    },

    // All moves as { from, to, arrow }
    moves(state, side) {
        const out = [];
        for (const [r, c] of this.amazons(state, side)) {
            for (const [tr, tc] of this.reach(state, r, c)) {
                const after = this.clone(state);
                after.cells[r][c] = 0;
                after.cells[tr][tc] = side;
                for (const [ar, ac] of this.reach(after, tr, tc)) out.push({ from: [r, c], to: [tr, tc], arrow: [ar, ac] });
            }
        }
        return out;
    },

    hasMove(state, side) {
        return this.amazons(state, side).some(([r, c]) => this.reach(state, r, c).length > 0);
    },

    apply(state, move) {
        const next = this.clone(state);
        const side = next.cells[move.from[0]][move.from[1]];
        next.cells[move.from[0]][move.from[1]] = 0;
        next.cells[move.to[0]][move.to[1]] = side;
        next.cells[move.arrow[0]][move.arrow[1]] = 3;
        return next;
    },

    // Queen-move distance from each side's amazons to every empty square (BFS in queen steps)
    territory(state) {
        const n = state.size;
        const dist = side => {
            const d = Array.from({ length: n }, () => Array(n).fill(Infinity));
            let frontier = this.amazons(state, side);
            frontier.forEach(([r, c]) => { d[r][c] = 0; });
            let step = 1;
            while (frontier.length) {
                const next = [];
                for (const [r, c] of frontier) {
                    for (const [nr, nc] of this.reach(state, r, c)) {
                        if (d[nr][nc] > step) { d[nr][nc] = step; next.push([nr, nc]); }
                    }
                }
                frontier = next;
                step++;
            }
            return d;
        };
        const mine = dist(2);
        const theirs = dist(1);
        let score = 0;
        for (let r = 0; r < n; r++) {
            for (let c = 0; c < n; c++) {
                if (state.cells[r][c] !== 0) continue;
                if (mine[r][c] < theirs[r][c]) score++;
                else if (theirs[r][c] < mine[r][c]) score--;
            }
        }
        return score;
    },

    mobility(state, side) {
        return this.amazons(state, side).reduce((sum, [r, c]) => sum + this.reach(state, r, c).length, 0);
    },

    // Position value from the AI's point of view
    evaluate(state) {
        return this.territory(state) * 3 + (this.mobility(state, 2) - this.mobility(state, 1)) * 0.5;
    },

    getNoviceMove(state) {
        const moves = this.moves(state, 2);
        if (!moves.length) return null;
        // prefer moves that keep the moved amazon mobile, with plenty of randomness
        const scored = moves.map(m => ({ m, s: this.mobility(this.apply(state, m), 2) + Math.random() * 20 }));
        scored.sort((a, b) => b.s - a.s);
        return scored[0].m;
    },

    // Master: one full ply of territory evaluation, then the best candidates are
    // checked against the player's strongest replies, within a time budget
    getMasterMove(state, budgetMs = 1200) {
        const start = performance.now();
        const moves = this.moves(state, 2);
        if (!moves.length) return null;
        const scored = moves.map(m => ({ m, next: this.apply(state, m), s: 0 }));
        for (const item of scored) item.s = this.evaluate(item.next);
        scored.sort((a, b) => b.s - a.s);
        let best = scored[0];
        let bestValue = -Infinity;
        for (const item of scored.slice(0, 12)) {
            if (performance.now() - start > budgetMs) break;
            const replies = this.moves(item.next, 1);
            if (!replies.length) return item.m; // the player cannot move: win
            // the player's best reply by a cheap ordering, deepened for the top few
            const ordered = replies.map(r => ({ r, s: this.mobility(this.apply(item.next, r), 1) })).sort((a, b) => b.s - a.s).slice(0, 15);
            let worst = Infinity;
            for (const { r } of ordered) {
                const value = this.evaluate(this.apply(item.next, r));
                if (value < worst) worst = value;
                if (worst < bestValue) break;
            }
            if (worst > bestValue) { bestValue = worst; best = item; }
        }
        return best.m;
    }
};
