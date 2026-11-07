/**
 * Frogger. Hop the frog from the bottom across a road of cars and a river
 * of logs and turtles into the empty homes at the top. Cars kill on touch;
 * in the river you must stand on something that floats, and it carries you.
 * Fill the required number of homes to win; you have three lives.
 * Rows from the top: homes, river lanes, a safe median, road lanes, start.
 */
const FroggerEngine = {
    COLS: 11,
    HOMES: [1, 3, 5, 7, 9],
    DT: 1 / 30,

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

    // Lanes: { type: 'road' | 'river', speed (cols/s, signed), length, gap, kind }
    create(level) {
        const rand = this.rng(level.seed);
        const lanes = [];
        const rows = 1 + level.river + 1 + level.road + 1;
        for (let r = 1; r <= level.river; r++) {
            const dir = r % 2 ? 1 : -1;
            const length = 2 + Math.floor(rand() * 2) + (rand() < 0.3 ? 1 : 0);
            lanes.push({ row: r, type: 'river', speed: dir * (level.speed * (0.8 + rand() * 0.5)), length, gap: level.riverGap + Math.floor(rand() * 2), kind: rand() < 0.4 ? 'turtle' : 'log', phase: rand() * 10 });
        }
        for (let r = level.river + 2; r < rows - 1; r++) {
            const dir = r % 2 ? -1 : 1;
            lanes.push({ row: r, type: 'road', speed: dir * (level.speed * (0.9 + rand() * 0.8)), length: rand() < 0.3 ? 2 : 1, gap: level.roadGap + Math.floor(rand() * 2), kind: 'car', color: ['#f06a6a', '#f5b301', '#5b8cff', '#e8ecf4'][Math.floor(rand() * 4)], phase: rand() * 10 });
        }
        return { lanes, rows, river: level.river, median: level.river + 1, start: rows - 1, needed: level.homes,
            frog: { x: 5, row: rows - 1, alive: true }, homes: this.HOMES.map(() => false), lives: 3, time: 0, result: null, lastDeath: null };
    },

    laneAt(state, row) {
        return state.lanes.find(l => l.row === row) || null;
    },

    // Objects of a lane as [x, x + length) spans in column units at the current time (repeating pattern)
    spans(lane, time) {
        const period = lane.length + lane.gap;
        const offset = ((lane.speed * time + lane.phase) % period + period) % period;
        const out = [];
        for (let x = offset - period * 2; x < this.COLS + period; x += period) out.push([x, x + lane.length]);
        return out;
    },

    onFloat(lane, time, x) {
        return this.spans(lane, time).find(([a, b]) => x + 0.5 > a + 0.1 && x + 0.5 < b - 0.1) || null;
    },

    hitByCar(lane, time, x) {
        return this.spans(lane, time).some(([a, b]) => x + 0.65 > a && x + 0.35 < b);
    },

    hop(state, dir) {
        if (state.result || !state.frog.alive) return false;
        const f = state.frog;
        const moves = { up: [-1, 0], down: [1, 0], left: [0, -1], right: [0, 1] };
        const [dr, dc] = moves[dir];
        const nr = f.row + dr;
        const nc = Math.round(f.x) + dc;
        if (nr < 0 || nr > state.start || nc < 0 || nc >= this.COLS) return false;
        if (nr === 0) {
            const slot = this.HOMES.indexOf(nc);
            if (slot < 0 || state.homes[slot]) { this.die(state, 'home'); return true; }
            state.homes[slot] = true;
            if (state.homes.filter(Boolean).length >= state.needed) { state.result = 'won'; return true; }
            f.x = 5; f.row = state.start;
            return true;
        }
        f.row = nr;
        f.x = nc;
        return true;
    },

    die(state, cause) {
        state.lives--;
        state.lastDeath = cause;
        state.frog.alive = false;
        state.frog.respawn = 1.0;
        if (state.lives <= 0) state.result = 'lost';
    },

    step(state, dt = this.DT) {
        if (state.result) return state;
        state.time += dt;
        const f = state.frog;
        if (!f.alive) {
            f.respawn -= dt;
            if (f.respawn <= 0) { f.alive = true; f.x = 5; f.row = state.start; }
            return state;
        }
        const lane = this.laneAt(state, f.row);
        if (!lane) return state;
        if (lane.type === 'road') {
            if (this.hitByCar(lane, state.time, f.x)) this.die(state, 'car');
        } else {
            const span = this.onFloat(lane, state.time, f.x);
            if (!span) { this.die(state, 'water'); return state; }
            f.x += lane.speed * dt;
            if (f.x < -0.5 || f.x > this.COLS - 0.5) this.die(state, 'edge');
        }
        return state;
    }
};
