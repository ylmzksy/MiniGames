/**
 * Pipe Mania. Lay pipe pieces from the queue on the grid before the ooze starts
 * flowing from the pump. The ooze advances one pipe per tick and must travel
 * through at least `target` pipes (or reach the drain) before it spills out of
 * an open end. Pieces: h (left-right), v (up-down), ne, nw, se, sw (corners
 * named by their two open sides), x (crossing, can be filled in both axes).
 */
const PipeEngine = {
    openings: { h: ['left', 'right'], v: ['up', 'down'], ne: ['up', 'right'], nw: ['up', 'left'], se: ['down', 'right'], sw: ['down', 'left'], x: ['up', 'down', 'left', 'right'] },
    directions: { up: [-1, 0], down: [1, 0], left: [0, -1], right: [0, 1] },
    opposite: { up: 'down', down: 'up', left: 'right', right: 'left' },
    weights: [['h', 3], ['v', 3], ['ne', 2], ['nw', 2], ['se', 2], ['sw', 2], ['x', 1]],

    rng(seed) {
        let a = seed >>> 0;
        return () => {
            a = (a + 0x6D2B79F5) >>> 0;
            let t = a;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    },

    create(level) {
        const rand = this.rng(level.seed);
        const total = this.weights.reduce((s, [, w]) => s + w, 0);
        const draw = () => {
            let x = rand() * total;
            for (const [type, w] of this.weights) { if ((x -= w) < 0) return type; }
            return 'h';
        };
        const queue = Array.from({ length: 200 }, draw);
        const cells = Array.from({ length: level.height }, () => Array(level.width).fill(null));
        return {
            width: level.width, height: level.height, cells, queue,
            source: level.source, sourceDir: level.sourceDir, drain: level.drain || null,
            target: level.target, countdown: level.countdown, filled: 0,
            ooze: { r: level.source[0], c: level.source[1], dir: level.sourceDir }, // where the ooze front is and where it heads next
            flowing: false, spilled: false, won: false, placements: 0
        };
    },

    isSpecial(state, r, c) {
        return (r === state.source[0] && c === state.source[1]) || (state.drain && r === state.drain[0] && c === state.drain[1]);
    },

    // Places the next piece from the queue; replacing an unfilled pipe costs countdown time
    place(state, r, c) {
        if (state.won || state.spilled) return false;
        if (r < 0 || c < 0 || r >= state.height || c >= state.width || this.isSpecial(state, r, c)) return false;
        const existing = state.cells[r][c];
        if (existing && existing.filled.length) return false;
        if (existing) state.countdown = Math.max(0, state.countdown - 2);
        state.cells[r][c] = { type: state.queue.shift(), filled: [] };
        state.placements++;
        return true;
    },

    // Advances the ooze by one pipe; returns 'flow', 'win' or 'spill'
    flow(state) {
        const [dr, dc] = this.directions[state.ooze.dir];
        const r = state.ooze.r + dr;
        const c = state.ooze.c + dc;
        const from = this.opposite[state.ooze.dir];
        if (state.drain && r === state.drain[0] && c === state.drain[1]) {
            if (state.drain[2] === from) { state.won = true; return 'win'; }
            return this.spill(state);
        }
        const pipe = state.cells[r]?.[c];
        if (!pipe || !this.openings[pipe.type].includes(from)) return this.spill(state);
        const axis = from === 'left' || from === 'right' ? 'h' : 'v';
        if (pipe.type === 'x' ? pipe.filled.includes(axis) : pipe.filled.length) return this.spill(state);
        pipe.filled.push(pipe.type === 'x' ? axis : 'all');
        state.filled++;
        const out = pipe.type === 'x' ? state.ooze.dir : this.openings[pipe.type].find(d => d !== from);
        state.ooze = { r, c, dir: out };
        if (state.filled >= state.target) { state.won = true; return 'win'; }
        return 'flow';
    },

    spill(state) {
        state.spilled = true;
        if (state.filled >= state.target) { state.won = true; return 'win'; }
        return 'spill';
    },

    // One timer tick: counts down, then flows
    tick(state) {
        if (state.won || state.spilled) return null;
        if (state.countdown > 0) { state.countdown--; if (state.countdown === 0) state.flowing = true; return 'count'; }
        state.flowing = true;
        return this.flow(state);
    }
};
