/**
 * Go on a small board. Black (the player) and white (the AI) alternate
 * placing stones; a group with no liberties is captured; suicide is illegal;
 * the simple ko rule forbids retaking the single stone that just captured a
 * single stone. Two passes in a row end the game. Area scoring: stones plus
 * empty points surrounded only by one color, white adds komi. Dead stones
 * are not removed, so players should capture them before passing.
 * Board cells: 0 empty, 1 black, 2 white, stored in a flat Uint8Array.
 */
const GoEngine = {
    BLACK: 1,
    WHITE: 2,

    create(level) {
        const n = level.size;
        return { size: n, cells: new Uint8Array(n * n), turn: 1, ko: -1, passes: 0, captures: { 1: 0, 2: 0 }, komi: level.komi, over: false, last: -1 };
    },

    clone(state) {
        return { ...state, cells: new Uint8Array(state.cells), captures: { ...state.captures } };
    },

    neighbors(n, i) {
        const r = Math.floor(i / n);
        const c = i % n;
        const out = [];
        if (r > 0) out.push(i - n);
        if (r < n - 1) out.push(i + n);
        if (c > 0) out.push(i - 1);
        if (c < n - 1) out.push(i + 1);
        return out;
    },

    // Group containing i and whether it has a liberty; returns { stones, liberties }
    group(cells, n, i) {
        const color = cells[i];
        const stones = [i];
        const seen = new Uint8Array(n * n);
        seen[i] = 1;
        let liberties = 0;
        for (let k = 0; k < stones.length; k++) {
            for (const j of this.neighbors(n, stones[k])) {
                if (seen[j]) continue;
                if (cells[j] === 0) { liberties++; seen[j] = 1; }
                else if (cells[j] === color) { seen[j] = 1; stones.push(j); }
            }
        }
        return { stones, liberties };
    },

    // Plays a stone for the side to move; returns the new state or null when illegal
    play(state, i) {
        if (state.over || state.cells[i] !== 0 || i === state.ko) return null;
        const n = state.size;
        const next = this.clone(state);
        const me = state.turn;
        const them = 3 - me;
        next.cells[i] = me;
        let captured = [];
        for (const j of this.neighbors(n, i)) {
            if (next.cells[j] !== them) continue;
            const g = this.group(next.cells, n, j);
            if (g.liberties === 0) captured = captured.concat(g.stones);
        }
        captured = [...new Set(captured)];
        captured.forEach(j => { next.cells[j] = 0; });
        if (!captured.length && this.group(next.cells, n, i).liberties === 0) return null; // suicide
        next.captures[me] += captured.length;
        // simple ko: a single stone capturing a single stone cannot be retaken at once
        next.ko = captured.length === 1 && this.group(next.cells, n, i).stones.length === 1 && this.group(next.cells, n, i).liberties === 1 ? captured[0] : -1;
        next.turn = them;
        next.passes = 0;
        next.last = i;
        return next;
    },

    pass(state) {
        const next = this.clone(state);
        next.turn = 3 - state.turn;
        next.passes = state.passes + 1;
        next.ko = -1;
        next.last = -1;
        if (next.passes >= 2) next.over = true;
        return next;
    },

    legalMoves(state) {
        const out = [];
        for (let i = 0; i < state.cells.length; i++) if (this.play(state, i)) out.push(i);
        return out;
    },

    // An empty point whose neighbors are all own stones (a simple eye) should not be filled
    isOwnEye(cells, n, i, color) {
        return this.neighbors(n, i).every(j => cells[j] === color);
    },

    // Area score: stones plus empty regions touching only one color
    score(state) {
        const n = state.size;
        const { cells } = state;
        const total = { 1: 0, 2: 0 };
        const seen = new Uint8Array(n * n);
        for (let i = 0; i < cells.length; i++) {
            if (cells[i]) { total[cells[i]]++; continue; }
            if (seen[i]) continue;
            const region = [i];
            seen[i] = 1;
            const touches = new Set();
            for (let k = 0; k < region.length; k++) {
                for (const j of this.neighbors(n, region[k])) {
                    if (cells[j]) touches.add(cells[j]);
                    else if (!seen[j]) { seen[j] = 1; region.push(j); }
                }
            }
            if (touches.size === 1) total[[...touches][0]] += region.length;
        }
        return { black: total[1], white: total[2] + state.komi };
    },

    winner(state) {
        const s = this.score(state);
        return s.black > s.white ? 1 : 2;
    },

    // ---------- Monte Carlo AI ----------
    // Random game to the end from a state; returns the winner
    playout(state, rand) {
        const n = state.size;
        const cells = new Uint8Array(state.cells);
        let turn = state.turn;
        let ko = state.ko;
        let passes = state.passes;
        const maxMoves = n * n * 3;
        for (let moves = 0; moves < maxMoves && passes < 2; moves++) {
            const empties = [];
            for (let i = 0; i < cells.length; i++) if (cells[i] === 0 && i !== ko && !this.isOwnEye(cells, n, i, turn)) empties.push(i);
            let played = false;
            // try a few random points before giving up and passing
            for (let t = 0; t < 8 && empties.length && !played; t++) {
                const idx = Math.floor(rand() * empties.length);
                const i = empties[idx];
                empties[idx] = empties[empties.length - 1];
                empties.pop();
                const result = this.playFast(cells, n, i, turn, ko);
                if (result === null) continue;
                ko = result;
                played = true;
            }
            if (played) passes = 0; else { passes++; ko = -1; }
            turn = 3 - turn;
        }
        const fake = { size: n, cells, komi: state.komi };
        return this.winner(fake);
    },

    // In-place play used by playouts; returns the new ko point or null when illegal
    playFast(cells, n, i, me, ko) {
        if (cells[i] !== 0 || i === ko) return null;
        const them = 3 - me;
        cells[i] = me;
        let captured = [];
        for (const j of this.neighbors(n, i)) {
            if (cells[j] !== them) continue;
            const g = this.group(cells, n, j);
            if (g.liberties === 0) captured = captured.concat(g.stones);
        }
        captured.forEach(j => { cells[j] = 0; });
        if (!captured.length && this.group(cells, n, i).liberties === 0) { cells[i] = 0; return null; }
        if (captured.length === 1) {
            const g = this.group(cells, n, i);
            if (g.stones.length === 1 && g.liberties === 1) return captured[0];
        }
        return -1;
    },

    // Picks a move for the side to move by UCB-allocated random playouts within a time budget
    getMove(state, budgetMs, randomness = 0) {
        const n = state.size;
        const me = state.turn;
        const candidates = this.legalMoves(state).filter(i => !this.isOwnEye(state.cells, n, i, me));
        if (!candidates.length) return -1; // pass
        const stats = candidates.map(i => ({ i, wins: 0, plays: 0, next: this.play(state, i) }));
        const rand = Math.random;
        const start = performance.now();
        const maxPlayouts = Math.max(40, Math.round(budgetMs * 2)); // also bounds the work when the clock is slow
        let total = 0;
        while (performance.now() - start < budgetMs && total < maxPlayouts) {
            let pick = stats[0];
            let best = -Infinity;
            for (const s of stats) {
                const ucb = s.plays === 0 ? Infinity : s.wins / s.plays + 1.2 * Math.sqrt(Math.log(total + 1) / s.plays);
                if (ucb > best) { best = ucb; pick = s; }
            }
            if (this.playout(pick.next, rand) === me) pick.wins++;
            pick.plays++;
            total++;
        }
        let choice = stats.reduce((a, b) => (b.plays > a.plays || (b.plays === a.plays && b.wins > a.wins)) ? b : a, stats[0]);
        if (randomness && Math.random() < randomness) choice = stats[Math.floor(Math.random() * stats.length)];
        // when the best move still loses almost every playout, passing is honest
        const rate = choice.plays ? choice.wins / choice.plays : 0;
        if (rate < 0.03 && total > 50) return -1;
        return choice.i;
    }
};
