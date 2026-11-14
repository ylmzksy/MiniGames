/**
 * Mu Torere. A star board: eight outer points on a ring (kewai) and a
 * center (putahi). Each side has four stones. A stone moves to an adjacent
 * empty point: along the ring, or between a ring point and the center. A
 * stone may only move into the center when one of its ring neighbors is an
 * enemy stone. Whoever cannot move loses.
 * Board: array of 9 cells, 0..7 the ring, 8 the center; 'you', 'ai' or null.
 */
const MuTorereEngine = {
    CENTER: 8,

    create() {
        const board = Array(9).fill(null);
        for (let i = 0; i < 4; i++) board[i] = 'you';
        for (let i = 4; i < 8; i++) board[i] = 'ai';
        return { board, turn: 'you' };
    },

    other(p) {
        return p === 'you' ? 'ai' : 'you';
    },

    neighbors(i) {
        if (i === this.CENTER) return [0, 1, 2, 3, 4, 5, 6, 7];
        return [(i + 7) % 8, (i + 1) % 8, this.CENTER];
    },

    moves(state, player = state.turn) {
        const out = [];
        const { board } = state;
        for (let i = 0; i < 9; i++) {
            if (board[i] !== player) continue;
            for (const j of this.neighbors(i)) {
                if (board[j] !== null) continue;
                if (j === this.CENTER) {
                    const ring = [(i + 7) % 8, (i + 1) % 8];
                    if (!ring.some(k => board[k] === this.other(player))) continue;
                }
                out.push({ from: i, to: j });
            }
        }
        return out;
    },

    apply(state, move) {
        const board = state.board.slice();
        board[move.to] = board[move.from];
        board[move.from] = null;
        return { board, turn: this.other(state.turn) };
    },

    key(state) {
        return state.board.map(v => v === 'you' ? 'Y' : v === 'ai' ? 'A' : '.').join('') + state.turn[0];
    },

    // Retrograde analysis over all positions: 'win' or 'loss' for the side to
    // move, undecided positions are draws (the game can cycle)
    solve() {
        if (this.table) return this.table;
        const states = [];
        const cells = [0, 1, 2, 3, 4, 5, 6, 7, 8];
        const choose = (rest, picked, k, acc) => {
            if (picked.length === k) { acc.push(picked); return; }
            rest.forEach((c, i) => choose(rest.slice(i + 1), picked.concat(c), k, acc));
        };
        const yous = []; choose(cells, [], 4, yous);
        yous.forEach(yc => {
            const remaining = cells.filter(c => !yc.includes(c));
            const ais = []; choose(remaining, [], 4, ais);
            ais.forEach(ac => {
                const board = Array(9).fill(null);
                yc.forEach(c => { board[c] = 'you'; });
                ac.forEach(c => { board[c] = 'ai'; });
                states.push({ board, turn: 'you' });
                states.push({ board: board.slice(), turn: 'ai' });
            });
        });
        const table = new Map();
        const succ = new Map();
        states.forEach(s => succ.set(this.key(s), this.moves(s).map(m => this.key(this.apply(s, m)))));
        states.forEach(s => { if (!succ.get(this.key(s)).length) table.set(this.key(s), 'loss'); });
        let changed = true;
        while (changed) {
            changed = false;
            for (const s of states) {
                const k = this.key(s);
                if (table.has(k)) continue;
                const next = succ.get(k);
                if (next.some(n => table.get(n) === 'loss')) { table.set(k, 'win'); changed = true; }
                else if (next.every(n => table.get(n) === 'win')) { table.set(k, 'loss'); changed = true; }
            }
        }
        this.table = table;
        return table;
    },

    outcome(state) {
        return this.solve().get(this.key(state)) || 'draw';
    },

    // Perfect play: a winning move, else a drawing move, else anything
    getPerfectMove(state) {
        const table = this.solve();
        const moves = this.moves(state);
        const rank = m => { const o = table.get(this.key(this.apply(state, m))) || 'draw'; return o === 'loss' ? 2 : o === 'draw' ? 1 : 0; };
        let best = [];
        let bestRank = -1;
        for (const m of moves) {
            const r = rank(m);
            if (r > bestRank) { bestRank = r; best = [m]; } else if (r === bestRank) best.push(m);
        }
        return best[Math.floor(Math.random() * best.length)];
    },

    // Shallow play: avoids moves after which it has no reply, otherwise random
    getShallowMove(state, plies) {
        const moves = this.moves(state);
        if (plies <= 0) return moves[Math.floor(Math.random() * moves.length)];
        const safe = moves.filter(m => {
            const next = this.apply(state, m);
            const replies = this.moves(next);
            if (!replies.length) return true; // opponent stuck: immediate win
            if (plies === 1) return true;
            // two plies: the opponent must not have a reply that leaves us stuck
            return !replies.some(r => this.moves(this.apply(next, r)).length === 0);
        });
        const winning = moves.filter(m => !this.moves(this.apply(state, m)).length);
        if (winning.length) return winning[0];
        const pool = safe.length ? safe : moves;
        return pool[Math.floor(Math.random() * pool.length)];
    },

    getNoviceMove(state) {
        const moves = this.moves(state);
        return moves[Math.floor(Math.random() * moves.length)];
    },

    getMasterMove(state, strength, mistake = 0) {
        if (Math.random() < mistake) return this.getNoviceMove(state);
        if (strength === 'perfect') return this.getPerfectMove(state);
        if (strength === 'random') return this.getNoviceMove(state);
        return this.getShallowMove(state, strength === 'two' ? 2 : 1);
    }
};
