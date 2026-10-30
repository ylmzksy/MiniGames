/**
 * Digger. Dig tunnels, collect every emerald, and survive the nobbins that
 * come out of their den and hunt you through the tunnels. You can shoot
 * (one shot at a time, slow to reload) and drop gold bags on them: a bag
 * falls when nothing is under it, crushes whatever it lands on, and bursts
 * into gold after a long fall. Monsters only move through dug tunnels.
 * Map: '#' wall, '.' dirt, ' ' tunnel, '*' emerald, 'B' gold bag, '$' gold,
 *      'D' you, 'S' the monsters' den (a tunnel cell).
 * The game advances in ticks.
 */
const DiggerEngine = {
    directions: { up: [-1, 0], down: [1, 0], left: [0, -1], right: [0, 1] },
    RELOAD: 12,

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

    parse(level) {
        const cells = level.map.map(row => [...row]);
        const height = cells.length;
        const width = Math.max(...cells.map(r => r.length));
        cells.forEach(row => { while (row.length < width) row.push(' '); });
        let player = null;
        let den = null;
        cells.forEach((row, r) => row.forEach((ch, c) => {
            if (ch === 'D') { player = [r, c]; row[c] = ' '; }
            if (ch === 'S') { den = [r, c]; row[c] = ' '; }
        }));
        return {
            width, height, cells, player, den, facing: 'right',
            monsters: [], toSpawn: level.monsters, spawnEvery: level.spawnEvery, monsterSpeed: level.monsterSpeed,
            bullet: null, reload: 0, falling: new Map(), // bag key -> cells fallen
            tick: 0, score: 0, dead: false, cleared: false, rand: this.rng(level.seed || 1)
        };
    },

    emeraldsLeft(state) {
        return state.cells.flat().filter(ch => ch === '*').length;
    },

    monsterAt(state, r, c) {
        return state.monsters.findIndex(m => m[0] === r && m[1] === c);
    },

    isTunnel(state, r, c) {
        const ch = state.cells[r]?.[c];
        return ch === ' ' || ch === '$';
    },

    movePlayer(state, dir) {
        const [dr, dc] = this.directions[dir];
        state.facing = dir;
        const [r, c] = state.player;
        const nr = r + dr;
        const nc = c + dc;
        const target = state.cells[nr]?.[nc];
        if (target === undefined || target === '#') return;
        if (target === 'B') {
            if (dr !== 0 || state.cells[nr][nc + dc] !== ' ' || state.falling.has(`${nr},${nc}`)) return;
            state.cells[nr][nc + dc] = 'B';
            state.cells[nr][nc] = ' ';
        } else if (target === '*') {
            state.score += 25;
        } else if (target === '$') {
            state.score += 100;
        }
        state.cells[nr][nc] = ' ';
        state.player = [nr, nc];
        if (this.monsterAt(state, nr, nc) >= 0) state.dead = true;
    },

    fire(state) {
        if (state.bullet || state.reload > 0) return;
        const [dr, dc] = this.directions[state.facing];
        state.bullet = { r: state.player[0], c: state.player[1], dr, dc };
        state.reload = this.RELOAD;
    },

    // The bullet flies two cells per tick through tunnels only
    moveBullet(state) {
        if (!state.bullet) return;
        for (let i = 0; i < 2 && state.bullet; i++) {
            const b = state.bullet;
            b.r += b.dr;
            b.c += b.dc;
            const hit = this.monsterAt(state, b.r, b.c);
            if (hit >= 0) { state.monsters.splice(hit, 1); state.score += 250; state.bullet = null; return; }
            if (!this.isTunnel(state, b.r, b.c)) state.bullet = null;
        }
    },

    // Bags fall into tunnels; a bag that has fallen two cells or more bursts into gold when it lands
    physics(state) {
        const falling = new Map();
        const moved = new Set();
        const { cells } = state;
        for (let r = state.height - 1; r >= 0; r--) {
            for (let c = 0; c < state.width; c++) {
                if (cells[r][c] !== 'B' || moved.has(`${r},${c}`)) continue;
                const key = `${r},${c}`;
                const fell = state.falling.get(key) ?? -1; // -1 = resting
                const below = cells[r + 1]?.[c] ?? '#'; // the map edge is solid
                const monsterBelow = this.monsterAt(state, r + 1, c);
                const playerBelow = state.player[0] === r + 1 && state.player[1] === c;
                if (below === ' ' && monsterBelow < 0 && !playerBelow) {
                    cells[r][c] = ' ';
                    cells[r + 1][c] = 'B';
                    falling.set(`${r + 1},${c}`, fell + 1);
                    moved.add(`${r + 1},${c}`);
                } else if (fell >= 0 && (monsterBelow >= 0 || playerBelow) && below === ' ') {
                    // a falling bag crushes whatever is under it
                    if (monsterBelow >= 0) { state.monsters.splice(monsterBelow, 1); state.score += 250; }
                    if (playerBelow) state.dead = true;
                    cells[r][c] = ' ';
                    cells[r + 1][c] = fell + 1 >= 2 ? '$' : 'B';
                } else if (fell >= 2) {
                    cells[r][c] = '$';
                } else if (fell >= 0) {
                    // landed after a short drop: stays a bag
                }
            }
        }
        state.falling = falling;
    },

    // Shortest tunnel distance from every cell to the player, for the monsters
    distances(state) {
        const dist = Array.from({ length: state.height }, () => Array(state.width).fill(Infinity));
        const queue = [state.player];
        dist[state.player[0]][state.player[1]] = 0;
        while (queue.length) {
            const [r, c] = queue.shift();
            for (const [dr, dc] of Object.values(this.directions)) {
                const nr = r + dr;
                const nc = c + dc;
                if (!this.isTunnel(state, nr, nc) || dist[nr][nc] !== Infinity) continue;
                dist[nr][nc] = dist[r][c] + 1;
                queue.push([nr, nc]);
            }
        }
        return dist;
    },

    moveMonsters(state) {
        if (state.tick % state.monsterSpeed !== 0) return;
        const dist = this.distances(state);
        state.monsters.forEach(m => {
            const options = Object.values(this.directions)
                .map(([dr, dc]) => [m[0] + dr, m[1] + dc])
                .filter(([r, c]) => this.isTunnel(state, r, c) && this.monsterAt(state, r, c) < 0);
            if (!options.length) return;
            // mostly toward the player, sometimes a random wander
            let pick;
            if (state.rand() < 0.2) {
                pick = options[Math.floor(state.rand() * options.length)];
            } else {
                pick = options.reduce((best, o) => dist[o[0]][o[1]] < dist[best[0]][best[1]] ? o : best, options[0]);
            }
            m[0] = pick[0];
            m[1] = pick[1];
            if (m[0] === state.player[0] && m[1] === state.player[1]) state.dead = true;
        });
    },

    spawn(state) {
        if (state.toSpawn <= 0 || state.tick % state.spawnEvery !== 0) return;
        const [r, c] = state.den;
        if (this.monsterAt(state, r, c) >= 0) return;
        state.monsters.push([r, c]);
        state.toSpawn--;
    },

    // A full tick: move (or fire), bullet, bags, monsters, spawning
    step(state, action) {
        if (state.dead || state.cleared) return state;
        state.tick++;
        if (state.reload > 0) state.reload--;
        if (action === 'fire') this.fire(state);
        else if (action) this.movePlayer(state, action);
        this.moveBullet(state);
        this.physics(state);
        if (!state.dead) this.moveMonsters(state);
        if (!state.dead) this.spawn(state);
        if (!state.dead && this.emeraldsLeft(state) === 0) state.cleared = true;
        return state;
    }
};
