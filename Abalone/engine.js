/**
 * Abalone on a hexagonal board of side 5 (61 cells). A move pushes one, two
 * or three of your marbles that lie in a line: in-line (along the line) or
 * broadside (sideways into empty cells). An in-line push may shove a shorter
 * enemy line (2 vs 1, 3 vs 1, 3 vs 2) when the cell behind it is empty or
 * off the board; marbles pushed off are lost. Push off enough enemy marbles
 * to win. Cells use axial coordinates [q, r].
 */
const AbaloneEngine = {
    dirs: [[1, 0], [-1, 0], [0, 1], [0, -1], [1, -1], [-1, 1]],
    axes: [[1, 0], [0, 1], [1, -1]],

    cells() {
        if (this._cells) return this._cells;
        const out = [];
        for (let q = -4; q <= 4; q++) for (let r = -4; r <= 4; r++) if (Math.abs(q + r) <= 4) out.push([q, r]);
        this._cells = out;
        return out;
    },

    key(q, r) { return `${q},${r}`; },
    onBoard(q, r) { return Math.abs(q) <= 4 && Math.abs(r) <= 4 && Math.abs(q + r) <= 4; },

    create(level) {
        const board = new Map();
        const place = (color, rows) => rows.forEach(([r, q0, q1]) => { for (let q = q0; q <= q1; q++) board.set(this.key(q, r), color); });
        if (level.layout === 'small') {
            place('blue', [[4, -4, 0], [3, -4, 1]]);
            place('red', [[-4, 0, 4], [-3, -1, 4]]);
        } else {
            place('blue', [[4, -4, 0], [3, -4, 1], [2, -2, 0]]);
            place('red', [[-4, 0, 4], [-3, -1, 4], [-2, 0, 2]]);
        }
        return { board, turn: 'blue', off: { blue: 0, red: 0 }, target: level.target, plies: 0, winner: null };
    },

    clone(s) { return { board: new Map(s.board), turn: s.turn, off: { ...s.off }, target: s.target, plies: s.plies, winner: s.winner }; },
    other(c) { return c === 'blue' ? 'red' : 'blue'; },
    at(s, q, r) { return s.board.get(this.key(q, r)) || null; },

    // Lines of 1-3 own marbles, each as an ordered list of [q, r] along an axis
    groups(s, color) {
        const out = [];
        for (const [q, r] of this.cells()) {
            if (this.at(s, q, r) !== color) continue;
            out.push([[q, r]]);
            for (const [dq, dr] of this.axes) {
                const line = [[q, r]];
                for (let k = 1; k < 3; k++) {
                    const nq = q + dq * k, nr = r + dr * k;
                    if (this.at(s, nq, nr) !== color) break;
                    line.push([nq, nr]);
                    out.push([...line]);
                }
            }
        }
        return out;
    },

    // The move of `group` in direction d, or null if illegal
    moveFor(s, group, d) {
        const color = this.at(s, ...group[0]);
        const n = group.length;
        const [dq, dr] = d;
        const axis = n > 1 ? [group[1][0] - group[0][0], group[1][1] - group[0][1]] : null;
        const inline = axis && ((axis[0] === dq && axis[1] === dr) || (axis[0] === -dq && axis[1] === -dr));
        if (inline || n === 1) {
            const front = n === 1 ? group[0] : (axis[0] === dq && axis[1] === dr ? group[n - 1] : group[0]);
            let q = front[0] + dq, r = front[1] + dr;
            if (!this.onBoard(q, r)) return n === 1 || inline ? null : null;
            const occ = this.at(s, q, r);
            if (!occ) return { group, d, type: 'move', pushed: 0, off: false };
            if (occ === color) return null;
            let k = 0;
            while (this.onBoard(q, r) && this.at(s, q, r) === this.other(color)) { k++; q += dq; r += dr; }
            if (k >= n) return null;
            if (this.onBoard(q, r) && this.at(s, q, r)) return null; // own marble behind the enemy line
            return { group, d, type: 'push', pushed: k, off: !this.onBoard(q, r) };
        }
        // broadside: every marble steps sideways into an empty on-board cell
        for (const [q, r] of group) {
            const nq = q + dq, nr = r + dr;
            if (!this.onBoard(nq, nr) || this.at(s, nq, nr)) return null;
        }
        return { group, d, type: 'side', pushed: 0, off: false };
    },

    moves(s, color = s.turn) {
        const out = [];
        for (const group of this.groups(s, color)) {
            for (const d of this.dirs) {
                const m = this.moveFor(s, group, d);
                if (m && !(group.length === 1 && m.type === 'side')) out.push(m);
            }
        }
        return out;
    },

    // Cells a move occupies after it is made (for highlighting): the new cells of the group
    targets(s, move) {
        const [dq, dr] = move.d;
        const set = new Set(move.group.map(([q, r]) => this.key(q, r)));
        return move.group.map(([q, r]) => [q + dq, r + dr]).filter(([q, r]) => !set.has(this.key(q, r)));
    },

    apply(s, move) {
        const next = this.clone(s);
        const color = this.at(s, ...move.group[0]);
        const enemy = this.other(color);
        const [dq, dr] = move.d;
        if (move.type === 'push') {
            // shove the enemy line first, farthest marble first
            const front = move.group.find(([q, r]) => this.at(s, q + dq, r + dr) === enemy);
            const chain = [];
            for (let k = 1; k <= move.pushed; k++) chain.push([front[0] + dq * k, front[1] + dr * k]);
            for (let i = chain.length - 1; i >= 0; i--) {
                const [q, r] = chain[i];
                next.board.delete(this.key(q, r));
                const nq = q + dq, nr = r + dr;
                if (this.onBoard(nq, nr)) next.board.set(this.key(nq, nr), enemy);
                else next.off[enemy]++;
            }
        }
        // move own marbles: clear then set (order-safe)
        move.group.forEach(([q, r]) => next.board.delete(this.key(q, r)));
        move.group.forEach(([q, r]) => next.board.set(this.key(q + dq, r + dr), color));
        next.plies++;
        if (next.off[enemy] >= next.target) next.winner = color;
        else if (next.plies >= 300) next.winner = 'draw';
        next.turn = enemy;
        return next;
    },

    distance(q, r) { return Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r)); },

    evaluate(s) {
        if (s.winner === 'red') return 100000;
        if (s.winner === 'blue') return -100000;
        if (s.winner === 'draw') return 0;
        let score = (s.off.blue - s.off.red) * 300;
        for (const [key, color] of s.board) {
            const [q, r] = key.split(',').map(Number);
            const sign = color === 'red' ? 1 : -1;
            score -= sign * this.distance(q, r) * 4;
            let friends = 0;
            for (const [dq, dr] of this.dirs) if (this.at(s, q + dq, r + dr) === color) friends++;
            score += sign * friends;
        }
        return score;
    },

    search(s, depth, alpha, beta, deadline) {
        if (s.winner || depth === 0) return this.evaluate(s);
        const maximizing = s.turn === 'red';
        let best = maximizing ? -Infinity : Infinity;
        const moves = this.moves(s);
        // pushes first for better pruning
        moves.sort((a, b) => (b.type === 'push') - (a.type === 'push'));
        for (const move of moves) {
            if (performance.now() > deadline) break;
            const value = this.search(this.apply(s, move), depth - 1, alpha, beta, deadline);
            if (maximizing) { best = Math.max(best, value); alpha = Math.max(alpha, value); }
            else { best = Math.min(best, value); beta = Math.min(beta, value); }
            if (beta <= alpha) break;
        }
        return best;
    },

    bestMove(s, maxDepth, budgetMs) {
        const deadline = performance.now() + budgetMs;
        const moves = this.moves(s);
        let best = moves[Math.floor(Math.random() * moves.length)];
        for (let depth = 1; depth <= maxDepth; depth++) {
            let bestScore = -Infinity, bestAtDepth = null;
            for (const move of moves) {
                const next = this.apply(s, move);
                if (next.winner === 'red') return move;
                const score = this.search(next, depth - 1, -Infinity, Infinity, deadline) + Math.random() * 0.5;
                if (score > bestScore) { bestScore = score; bestAtDepth = move; }
                if (performance.now() > deadline) break;
            }
            if (performance.now() > deadline) break;
            best = bestAtDepth;
        }
        return best;
    },

    getNoviceMove(s) { return this.bestMove(s, 1, 200); },
    getMasterMove(s, depth) { return this.bestMove(s, depth, 900); }
};
