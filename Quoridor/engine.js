/**
 * Quoridor. Two pawns race to the opposite side of an n x n board; each
 * turn you either step your pawn or place a wall. Walls are two cells long,
 * lie in the grooves between cells and may never cut off every path of
 * either pawn to its goal. A pawn facing the opponent jumps over it, or
 * sidesteps diagonally when something blocks the jump.
 * Wall {r, c, o}: o 'h' lies under cells (r,c),(r,c+1); o 'v' lies right of
 * cells (r,c),(r+1,c). Players: 'you' (goal row 0) and 'ai' (goal row n-1).
 */
const QuoridorEngine = {
    dirs: [[-1, 0], [1, 0], [0, -1], [0, 1]],

    create(level) {
        const n = level.size;
        const mid = Math.floor(n / 2);
        return {
            n,
            pawns: { you: [n - 1, mid], ai: [0, mid] },
            walls: { you: level.walls, ai: level.walls },
            placed: [],
            turn: 'you',
            winner: null
        };
    },

    clone(state) {
        return { n: state.n, pawns: { you: [...state.pawns.you], ai: [...state.pawns.ai] }, walls: { ...state.walls }, placed: state.placed.slice(), turn: state.turn, winner: state.winner };
    },

    goalRow(player, n) {
        return player === 'you' ? 0 : n - 1;
    },

    other(player) {
        return player === 'you' ? 'ai' : 'you';
    },

    // True when a wall separates the neighboring cells a and b
    blocked(state, [r1, c1], [r2, c2]) {
        for (const w of state.placed) {
            if (w.o === 'h') {
                const top = Math.min(r1, r2);
                if (c1 === c2 && r1 !== r2 && top === w.r && (c1 === w.c || c1 === w.c + 1)) return true;
            } else {
                const left = Math.min(c1, c2);
                if (r1 === r2 && c1 !== c2 && left === w.c && (r1 === w.r || r1 === w.r + 1)) return true;
            }
        }
        return false;
    },

    inside(n, [r, c]) {
        return r >= 0 && c >= 0 && r < n && c < n;
    },

    pawnMoves(state, player) {
        const me = state.pawns[player];
        const opp = state.pawns[this.other(player)];
        const out = [];
        for (const [dr, dc] of this.dirs) {
            const t = [me[0] + dr, me[1] + dc];
            if (!this.inside(state.n, t) || this.blocked(state, me, t)) continue;
            if (t[0] === opp[0] && t[1] === opp[1]) {
                const beyond = [t[0] + dr, t[1] + dc];
                if (this.inside(state.n, beyond) && !this.blocked(state, t, beyond)) {
                    out.push(beyond);
                } else {
                    for (const [pr, pc] of [[dc, dr], [-dc, -dr]]) {
                        const side = [t[0] + pr, t[1] + pc];
                        if (this.inside(state.n, side) && !this.blocked(state, t, side)) out.push(side);
                    }
                }
            } else {
                out.push(t);
            }
        }
        return out;
    },

    // Shortest path length from the player's pawn to its goal row, or Infinity
    distance(state, player) {
        const n = state.n;
        const goal = this.goalRow(player, n);
        const start = state.pawns[player];
        const seen = new Uint8Array(n * n);
        const queue = [[start[0], start[1], 0]];
        seen[start[0] * n + start[1]] = 1;
        for (let head = 0; head < queue.length; head++) {
            const [r, c, d] = queue[head];
            if (r === goal) return d;
            for (const [dr, dc] of this.dirs) {
                const t = [r + dr, c + dc];
                if (!this.inside(n, t) || seen[t[0] * n + t[1]] || this.blocked(state, [r, c], t)) continue;
                seen[t[0] * n + t[1]] = 1;
                queue.push([t[0], t[1], d + 1]);
            }
        }
        return Infinity;
    },

    wallOverlaps(state, w) {
        return state.placed.some(p => {
            if (p.o === w.o) {
                if (w.o === 'h') return p.r === w.r && Math.abs(p.c - w.c) <= 1;
                return p.c === w.c && Math.abs(p.r - w.r) <= 1;
            }
            return p.r === w.r && p.c === w.c; // crossing at the same intersection
        });
    },

    canPlaceWall(state, player, w) {
        if (state.walls[player] <= 0) return false;
        if (w.r < 0 || w.c < 0 || w.r > state.n - 2 || w.c > state.n - 2) return false;
        if (this.wallOverlaps(state, w)) return false;
        const next = this.clone(state);
        next.placed.push(w);
        return this.distance(next, 'you') < Infinity && this.distance(next, 'ai') < Infinity;
    },

    allWalls(state, player) {
        const out = [];
        if (state.walls[player] <= 0) return out;
        for (let r = 0; r <= state.n - 2; r++) {
            for (let c = 0; c <= state.n - 2; c++) {
                for (const o of ['h', 'v']) {
                    const w = { r, c, o };
                    if (this.canPlaceWall(state, player, w)) out.push(w);
                }
            }
        }
        return out;
    },

    apply(state, move) {
        const next = this.clone(state);
        const player = state.turn;
        if (move.type === 'move') {
            next.pawns[player] = [move.to[0], move.to[1]];
            if (move.to[0] === this.goalRow(player, state.n)) next.winner = player;
        } else {
            next.placed.push({ r: move.r, c: move.c, o: move.o });
            next.walls[player] -= 1;
        }
        next.turn = this.other(player);
        return next;
    },

    // Position value from the AI's point of view
    evaluate(state) {
        const dy = this.distance(state, 'you');
        const da = this.distance(state, 'ai');
        return (dy - da) * 10 + (state.walls.ai - state.walls.you) * 2;
    },

    // Pawn steps plus the walls that actually lengthen the opponent's path
    candidates(state, player) {
        const moves = this.pawnMoves(state, player).map(to => ({ type: 'move', to }));
        if (state.walls[player] > 0) {
            const opp = this.other(player);
            const base = this.distance(state, opp);
            const mine = this.distance(state, player);
            for (const w of this.allWalls(state, player)) {
                const next = this.clone(state);
                next.placed.push(w);
                const d = this.distance(next, opp);
                if (d > base && this.distance(next, player) <= mine + 1) moves.push({ type: 'wall', ...w, gain: d - base });
            }
        }
        return moves;
    },

    search(state, depth, alpha, beta, deadline) {
        if (state.winner) return state.winner === 'ai' ? 1000 + depth : -1000 - depth;
        if (depth === 0 || Date.now() > deadline) return this.evaluate(state);
        const player = state.turn;
        const maximizing = player === 'ai';
        const moves = this.candidates(state, player);
        moves.sort((a, b) => (b.gain || 0) - (a.gain || 0));
        let best = maximizing ? -Infinity : Infinity;
        for (const move of moves) {
            const value = this.search(this.apply(state, move), depth - 1, alpha, beta, deadline);
            if (maximizing) { best = Math.max(best, value); alpha = Math.max(alpha, value); }
            else { best = Math.min(best, value); beta = Math.min(beta, value); }
            if (beta <= alpha) break;
        }
        return best;
    },

    getMasterMove(state, depth, budgetMs = 800) {
        const deadline = Date.now() + budgetMs;
        const moves = this.candidates(state, 'ai');
        let best = null;
        for (let d = 1; d <= depth; d++) {
            let bestThis = null;
            for (const move of moves) {
                const value = this.search(this.apply(state, move), d - 1, -Infinity, Infinity, deadline);
                if (!bestThis || value > bestThis.value) bestThis = { move, value };
            }
            if (Date.now() > deadline && best) break;
            best = bestThis;
        }
        return best.move;
    },

    // Novice walks its shortest path and sometimes drops a wall in your way
    getNoviceMove(state) {
        const walls = state.walls.ai > 0 ? this.candidates(state, 'ai').filter(m => m.type === 'wall') : [];
        if (walls.length && Math.random() < 0.3) return walls[Math.floor(Math.random() * walls.length)];
        const moves = this.pawnMoves(state, 'ai');
        let best = null;
        for (const to of moves) {
            const next = this.clone(state);
            next.pawns.ai = to;
            const d = this.distance(next, 'ai');
            if (!best || d < best.d) best = { to, d };
        }
        return { type: 'move', to: best.to };
    }
};
