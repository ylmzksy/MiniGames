/**
 * Lode Runner. Run, climb ladders, hang from bars, dig holes in bricks to
 * trap the guards, collect all the gold, then climb the exit ladder that
 * appears at the top. Map: '#' brick (diggable), 'X' solid block, 'H' ladder,
 * '-' bar, '$' gold, 'R' you, 'G' guard, 'E' exit ladder (hidden until all
 * gold is collected), '.' empty. The game advances in ticks.
 */
const LodeEngine = {
    HOLE_TICKS: 32,     // ticks until a dug hole fills again
    TRAP_TICKS: 40,     // a trapped guard stays put until the hole fills (and dies)
    GUARD_EVERY: 3,     // guards move every N ticks

    parse(level) {
        const cells = level.map.map(row => [...row]);
        const height = cells.length;
        const width = Math.max(...cells.map(r => r.length));
        cells.forEach(row => { while (row.length < width) row.push('.'); });
        let player = null;
        const guards = [];
        let gold = 0;
        cells.forEach((row, r) => row.forEach((ch, c) => {
            if (ch === 'R') { player = { r, c }; row[c] = '.'; }
            else if (ch === 'G') { guards.push({ r, c, home: [r, c], trapped: 0, holeKey: null }); row[c] = '.'; }
            else if (ch === '$') gold++;
        }));
        return { width, height, cells, player, guards, gold, holes: new Map(), exitOpen: false, tick: 0, dead: false, won: false, facing: 'right', falling: false };
    },

    at(state, r, c) {
        if (r < 0 || c < 0 || r >= state.height || c >= state.width) return 'X';
        return state.cells[r][c];
    },

    isSolid(ch) {
        return ch === '#' || ch === 'X';
    },

    guardAt(state, r, c) {
        return state.guards.findIndex(g => g.r === r && g.c === c);
    },

    // A body at (r, c) is held up by the floor, a ladder, a bar or a trapped guard below
    supported(state, r, c) {
        const here = this.at(state, r, c);
        if (here === 'H' || here === '-' || (here === 'E' && state.exitOpen)) return true;
        const below = this.at(state, r + 1, c);
        if (this.isSolid(below) || below === 'H' || (below === 'E' && state.exitOpen)) return true;
        const g = this.guardAt(state, r + 1, c);
        return g >= 0 && state.guards[g].trapped > 0;
    },

    // Hidden exit-ladder cells behave like empty space until the exit opens
    canEnter(state, r, c) {
        return !this.isSolid(this.at(state, r, c));
    },

    // Tries to move a body one step; returns the new position or null
    stepBody(state, pos, dir) {
        const { r, c } = pos;
        const here = this.at(state, r, c);
        if (dir === 'left' || dir === 'right') {
            const nc = c + (dir === 'left' ? -1 : 1);
            return this.canEnter(state, r, nc) ? { r, c: nc } : null;
        }
        if (dir === 'up') {
            const onLadder = here === 'H' || (here === 'E' && state.exitOpen);
            if (!onLadder) return null;
            return this.canEnter(state, r - 1, c) ? { r: r - 1, c } : null;
        }
        if (dir === 'down') {
            if (!this.canEnter(state, r + 1, c)) return null;
            return { r: r + 1, c };
        }
        return null;
    },

    movePlayer(state, dir) {
        if (!this.supported(state, state.player.r, state.player.c)) return; // falling: no control
        if (dir === 'left' || dir === 'right') state.facing = dir;
        const next = this.stepBody(state, state.player, dir);
        if (!next) return;
        if (this.guardAt(state, next.r, next.c) >= 0 && state.guards[this.guardAt(state, next.r, next.c)].trapped === 0) { state.dead = true; return; }
        state.player = next;
        this.collect(state);
    },

    collect(state) {
        const { r, c } = state.player;
        if (state.cells[r][c] === '$') {
            state.cells[r][c] = '.';
            state.gold--;
            if (state.gold === 0) state.exitOpen = true;
        }
    },

    // Digs the brick diagonally below in the facing direction; the cell beside must be open
    dig(state, dir) {
        const { r, c } = state.player;
        const dc = dir === 'left' ? -1 : 1;
        state.facing = dir;
        if (!this.supported(state, r, c)) return false;
        const side = this.at(state, r, c + dc);
        if (this.isSolid(side) || side === 'H' || side === '$') return false;
        if (this.at(state, r + 1, c + dc) !== '#') return false;
        if (this.guardAt(state, r + 1, c + dc) >= 0) return false;
        state.cells[r + 1][c + dc] = '.';
        state.holes.set(`${r + 1},${c + dc}`, this.HOLE_TICKS);
        return true;
    },

    // Gravity for the player and the guards, hole timers, guard escapes
    physics(state) {
        const p = state.player;
        state.falling = false;
        if (!this.supported(state, p.r, p.c) && this.canEnter(state, p.r + 1, p.c)) {
            const g = this.guardAt(state, p.r + 1, p.c);
            if (g < 0 || state.guards[g].trapped > 0) {
                if (g < 0) { p.r += 1; state.falling = true; this.collect(state); }
            } else {
                state.dead = true;
            }
        }
        state.guards.forEach(g => {
            if (g.trapped > 0) return;
            if (!this.supported(state, g.r, g.c) && this.canEnter(state, g.r + 1, g.c) && this.guardAt(state, g.r + 1, g.c) < 0) {
                g.r += 1;
                const key = `${g.r},${g.c}`;
                if (state.holes.has(key)) { g.trapped = this.TRAP_TICKS; g.holeKey = key; }
            }
        });
        // holes fill back up
        for (const [key, ticks] of [...state.holes]) {
            if (ticks > 1) { state.holes.set(key, ticks - 1); continue; }
            state.holes.delete(key);
            const [hr, hc] = key.split(',').map(Number);
            state.cells[hr][hc] = '#';
            if (p.r === hr && p.c === hc) state.dead = true;
            state.guards.forEach(g => {
                if (g.r === hr && g.c === hc) { g.r = g.home[0]; g.c = g.home[1]; g.trapped = 0; g.holeKey = null; }
            });
        }
        // trapped guards climb out when their time is up
        state.guards.forEach(g => {
            if (g.trapped <= 0) return;
            g.trapped--;
            if (g.trapped === 0) {
                const up = { r: g.r - 1, c: g.c };
                if (this.canEnter(state, up.r, up.c) && this.guardAt(state, up.r, up.c) < 0) { g.r = up.r; g.holeKey = null; }
                else g.trapped = 4;
            }
        });
    },

    // Shortest path over the moves a guard may make, then one step along it
    moveGuards(state) {
        if (state.tick % this.GUARD_EVERY !== 0) return;
        const target = `${state.player.r},${state.player.c}`;
        state.guards.forEach(g => {
            if (g.trapped > 0 || !this.supported(state, g.r, g.c)) return;
            const start = { r: g.r, c: g.c };
            const prev = new Map([[`${g.r},${g.c}`, null]]);
            const queue = [start];
            let found = null;
            while (queue.length && !found) {
                const cur = queue.shift();
                for (const dir of ['left', 'right', 'up', 'down']) {
                    let nxt = this.stepBody(state, cur, dir);
                    if (!nxt) continue;
                    // falling is part of the move
                    let guardSteps = 0;
                    while (!this.supported(state, nxt.r, nxt.c) && this.canEnter(state, nxt.r + 1, nxt.c) && guardSteps++ < state.height) nxt = { r: nxt.r + 1, c: nxt.c };
                    const key = `${nxt.r},${nxt.c}`;
                    if (prev.has(key)) continue;
                    prev.set(key, { from: `${cur.r},${cur.c}`, dir });
                    if (key === target) { found = key; break; }
                    queue.push(nxt);
                }
            }
            let dir = null;
            if (found) {
                let key = found;
                while (prev.get(key) && prev.get(key).from !== `${g.r},${g.c}`) key = prev.get(key).from;
                dir = prev.get(key)?.dir;
            } else {
                // no full path: head straight toward the player anyway (and into any hole on the way)
                const dr = state.player.r - g.r;
                const dc = state.player.c - g.c;
                const order = Math.abs(dc) >= Math.abs(dr) ? [dc > 0 ? 'right' : 'left', dr > 0 ? 'down' : 'up'] : [dr > 0 ? 'down' : 'up', dc > 0 ? 'right' : 'left'];
                dir = order.find(d => (d === 'left' || d === 'right' || d === 'up' || (d === 'down' && this.at(state, g.r + 1, g.c) === 'H')) && this.stepBody(state, start, d)) || null;
            }
            if (!dir) return;
            const nxt = this.stepBody(state, start, dir);
            if (!nxt || this.guardAt(state, nxt.r, nxt.c) >= 0) return;
            g.r = nxt.r;
            g.c = nxt.c;
            const hk = `${g.r},${g.c}`;
            if (state.holes.has(hk)) { g.trapped = this.TRAP_TICKS; g.holeKey = hk; }
        });
        if (this.guardAt(state, state.player.r, state.player.c) >= 0) {
            const g = state.guards[this.guardAt(state, state.player.r, state.player.c)];
            if (g.trapped === 0) state.dead = true;
        }
    },

    // A full tick: the player's action, then gravity and holes, then the guards
    step(state, action) {
        if (state.dead || state.won) return state;
        state.tick++;
        if (action === 'digLeft') this.dig(state, 'left');
        else if (action === 'digRight') this.dig(state, 'right');
        else if (action) this.movePlayer(state, action);
        if (!state.dead) this.physics(state);
        if (!state.dead) this.moveGuards(state);
        if (!state.dead && state.exitOpen && state.player.r === 0 && this.at(state, 0, state.player.c) === 'E') state.won = true;
        return state;
    }
};
