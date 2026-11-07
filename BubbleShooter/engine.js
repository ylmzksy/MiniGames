/**
 * Bubble Shooter. Colored bubbles hang from the ceiling in a hex grid. You
 * shoot bubbles from the bottom; a shot bounces off the side walls and snaps
 * into the grid where it lands. Groups of three or more of one color pop,
 * and bubbles left hanging without a path to the ceiling drop. Every few
 * shots a new row is pushed in from the top. Clear the grid to win; lose
 * when a bubble reaches the bottom line.
 */
const BubbleEngine = {
    COLS: 9,
    R: 20,
    WIDTH: 400,
    HEIGHT: 520,
    SHOOTER_Y: 490,
    DANGER_Y: 450,
    SPEED: 520,
    COLORS: ['#e03b3b', '#3b6fe0', '#1f9d55', '#f5b301', '#9b4ddb', '#17b8c8', '#ff8c1a'],
    ROW_H: 20 * Math.sqrt(3), // vertical distance between rows

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
        const grid = [];
        for (let r = 0; r < level.rows; r++) {
            grid.push(Array.from({ length: this.COLS }, () => Math.floor(rand() * level.colors)));
        }
        const state = { grid, parity: 0, colors: level.colors, rand, shot: null, shots: 0, pushEvery: level.pushEvery, popped: 0, won: false, lost: false, angle: 0 };
        state.next = this.pickColor(state);
        state.after = this.pickColor(state);
        return state;
    },

    // Columns in a row: offset rows (by parity) have one bubble less of room; we keep COLS cells and shift
    cellCenter(state, r, c) {
        const offset = ((r + state.parity) % 2) ? this.R : 0;
        const left = (this.WIDTH - (this.COLS * 2 * this.R + this.R)) / 2;
        return [left + this.R + c * 2 * this.R + offset, this.R + r * this.ROW_H];
    },

    colorsLeft(state) {
        const set = new Set();
        state.grid.forEach(row => row.forEach(v => { if (v !== null) set.add(v); }));
        return [...set];
    },

    pickColor(state) {
        const left = this.colorsLeft(state);
        if (!left.length) return Math.floor(state.rand() * state.colors);
        return left[Math.floor(state.rand() * left.length)];
    },

    neighbors(state, r, c) {
        const odd = ((r + state.parity) % 2) === 1;
        const out = [[r, c - 1], [r, c + 1], [r - 1, c], [r + 1, c], odd ? [r - 1, c + 1] : [r - 1, c - 1], odd ? [r + 1, c + 1] : [r + 1, c - 1]];
        return out.filter(([nr, nc]) => nr >= 0 && nc >= 0 && nc < this.COLS);
    },

    at(state, r, c) {
        return state.grid[r]?.[c] ?? null;
    },

    fire(state, angle) {
        if (state.shot || state.won || state.lost) return false;
        const a = Math.max(-75, Math.min(75, angle)) * Math.PI / 180;
        state.shot = { x: this.WIDTH / 2, y: this.SHOOTER_Y, vx: Math.sin(a) * this.SPEED, vy: -Math.cos(a) * this.SPEED, color: state.next };
        state.next = state.after;
        state.after = this.pickColor(state);
        state.shots++;
        return true;
    },

    // Moves the shot; returns events: 'snap', 'pop', 'drop', 'push', 'won', 'lost'
    step(state, dt) {
        const events = [];
        const s = state.shot;
        if (!s || state.won || state.lost) return events;
        const steps = Math.ceil(this.SPEED * dt / 5);
        for (let i = 0; i < steps; i++) {
            s.x += s.vx * dt / steps;
            s.y += s.vy * dt / steps;
            if (s.x < this.R) { s.x = this.R; s.vx = Math.abs(s.vx); }
            if (s.x > this.WIDTH - this.R) { s.x = this.WIDTH - this.R; s.vx = -Math.abs(s.vx); }
            if (s.y <= this.R || this.touches(state, s.x, s.y)) {
                this.land(state, events);
                return events;
            }
        }
        return events;
    },

    touches(state, x, y) {
        for (let r = 0; r < state.grid.length; r++) {
            for (let c = 0; c < this.COLS; c++) {
                if (state.grid[r][c] === null) continue;
                const [cx, cy] = this.cellCenter(state, r, c);
                if (Math.hypot(cx - x, cy - y) < 2 * this.R * 0.92) return true;
            }
        }
        return false;
    },

    // Snaps the shot into the nearest free cell, then pops and drops
    land(state, events) {
        const s = state.shot;
        state.shot = null;
        let best = null;
        const rows = state.grid.length + 1;
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < this.COLS; c++) {
                if (this.at(state, r, c) !== null) continue;
                const [cx, cy] = this.cellCenter(state, r, c);
                if (((r + state.parity) % 2) && c === this.COLS - 1) continue; // offset rows are one cell narrower
                const d = Math.hypot(cx - s.x, cy - s.y);
                if (!best || d < best.d) best = { r, c, d };
            }
        }
        while (state.grid.length <= best.r) state.grid.push(Array(this.COLS).fill(null));
        state.grid[best.r][best.c] = s.color;
        events.push('snap');
        // pop the group
        const group = this.group(state, best.r, best.c);
        if (group.length >= 3) {
            group.forEach(([r, c]) => { state.grid[r][c] = null; });
            state.popped += group.length;
            events.push('pop');
            const dropped = this.dropLoose(state);
            if (dropped) { state.popped += dropped; events.push('drop'); }
        }
        this.trimRows(state);
        if (state.shots % state.pushEvery === 0 && !this.isEmpty(state)) { this.pushRow(state); events.push('push'); }
        if (this.isEmpty(state)) { state.won = true; events.push('won'); }
        else if (this.lowestY(state) + this.R > this.DANGER_Y) { state.lost = true; events.push('lost'); }
        return events;
    },

    group(state, r, c) {
        const color = state.grid[r][c];
        const seen = new Set([`${r},${c}`]);
        const queue = [[r, c]];
        const out = [];
        while (queue.length) {
            const [cr, cc] = queue.shift();
            out.push([cr, cc]);
            this.neighbors(state, cr, cc).forEach(([nr, nc]) => {
                const key = `${nr},${nc}`;
                if (!seen.has(key) && this.at(state, nr, nc) === color) { seen.add(key); queue.push([nr, nc]); }
            });
        }
        return out;
    },

    // Removes bubbles not connected to the top row; returns how many fell
    dropLoose(state) {
        const seen = new Set();
        const queue = [];
        for (let c = 0; c < this.COLS; c++) if (this.at(state, 0, c) !== null) { seen.add(`0,${c}`); queue.push([0, c]); }
        while (queue.length) {
            const [r, c] = queue.shift();
            this.neighbors(state, r, c).forEach(([nr, nc]) => {
                const key = `${nr},${nc}`;
                if (!seen.has(key) && this.at(state, nr, nc) !== null) { seen.add(key); queue.push([nr, nc]); }
            });
        }
        let dropped = 0;
        state.grid.forEach((row, r) => row.forEach((v, c) => {
            if (v !== null && !seen.has(`${r},${c}`)) { row[c] = null; dropped++; }
        }));
        return dropped;
    },

    trimRows(state) {
        while (state.grid.length && state.grid[state.grid.length - 1].every(v => v === null)) state.grid.pop();
    },

    pushRow(state) {
        state.parity = 1 - state.parity;
        const colors = this.colorsLeft(state);
        const row = Array.from({ length: this.COLS }, () => colors[Math.floor(state.rand() * colors.length)]);
        state.grid.unshift(row);
    },

    isEmpty(state) {
        return state.grid.every(row => row.every(v => v === null));
    },

    lowestY(state) {
        let y = 0;
        state.grid.forEach((row, r) => { if (row.some(v => v !== null)) y = this.cellCenter(state, r, 0)[1]; });
        return y;
    },

    // Where a shot at this angle would land (same physics, no side effects): [x, y]
    trace(state, angle) {
        const a = Math.max(-75, Math.min(75, angle)) * Math.PI / 180;
        let x = this.WIDTH / 2, y = this.SHOOTER_Y;
        let vx = Math.sin(a), vy = -Math.cos(a);
        for (let i = 0; i < 2000; i++) {
            x += vx * 4; y += vy * 4;
            if (x < this.R) { x = this.R; vx = Math.abs(vx); }
            if (x > this.WIDTH - this.R) { x = this.WIDTH - this.R; vx = -Math.abs(vx); }
            if (y <= this.R || this.touches(state, x, y)) break;
        }
        return [x, y];
    }
};
