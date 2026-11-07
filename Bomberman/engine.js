/**
 * Bomberman. A grid of indestructible pillars and breakable bricks with
 * wandering enemies. Drop bombs that explode in a cross after a short fuse,
 * blasting bricks, enemies and (careful) you. The exit hides under a brick:
 * clear every enemy, then walk into the exit.
 * Cells: '#' wall or pillar, 'B' brick, ' ' floor. Game advances in ticks.
 */
const BombEngine = {
    directions: { up: [-1, 0], down: [1, 0], left: [0, -1], right: [0, 1] },
    FUSE: 13,        // ticks until a bomb explodes (~2 s at 150 ms)
    FLAME: 3,        // ticks a flame stays
    RANGE: 2,

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
        const { width, height } = level;
        const cells = [];
        for (let r = 0; r < height; r++) {
            cells.push([]);
            for (let c = 0; c < width; c++) {
                const border = r === 0 || c === 0 || r === height - 1 || c === width - 1;
                cells[r][c] = border || (r % 2 === 0 && c % 2 === 0) ? '#' : ' ';
            }
        }
        const start = [1, 1];
        const free = [];
        for (let r = 1; r < height - 1; r++) {
            for (let c = 1; c < width - 1; c++) {
                if (cells[r][c] === ' ' && Math.abs(r - 1) + Math.abs(c - 1) > 2) free.push([r, c]);
            }
        }
        // bricks on a share of the free cells, the exit under one of them
        const shuffled = free.slice().sort(() => rand() - 0.5);
        const brickCount = Math.round(free.length * level.bricks);
        const bricks = shuffled.slice(0, brickCount);
        bricks.forEach(([r, c]) => { cells[r][c] = 'B'; });
        const exit = bricks[Math.floor(rand() * bricks.length)];
        // enemies on far floor cells
        const farFloor = shuffled.slice(brickCount).filter(([r, c]) => Math.abs(r - 1) + Math.abs(c - 1) >= 6);
        const enemies = farFloor.slice(0, level.enemies).map(([r, c]) => ({ r, c, dir: 'left' }));
        return { width, height, cells, player: start, exit, exitOpen: false, enemies, bombs: [], flames: new Map(), maxBombs: level.maxBombs || 1, tick: 0, dead: false, cleared: false, rand };
    },

    bombAt(state, r, c) {
        return state.bombs.some(b => b.r === r && b.c === c);
    },

    enemyAt(state, r, c) {
        return state.enemies.findIndex(e => e.r === r && e.c === c);
    },

    movePlayer(state, dir) {
        const [dr, dc] = this.directions[dir];
        const [r, c] = state.player;
        const nr = r + dr;
        const nc = c + dc;
        if (state.cells[nr][nc] !== ' ' || this.bombAt(state, nr, nc)) return;
        state.player = [nr, nc];
    },

    placeBomb(state) {
        const [r, c] = state.player;
        if (state.bombs.length >= state.maxBombs || this.bombAt(state, r, c)) return;
        state.bombs.push({ r, c, timer: this.FUSE });
    },

    explode(state, bomb) {
        state.bombs = state.bombs.filter(b => b !== bomb);
        const burn = (r, c) => { state.flames.set(`${r},${c}`, this.FLAME); };
        burn(bomb.r, bomb.c);
        Object.values(this.directions).forEach(([dr, dc]) => {
            for (let i = 1; i <= this.RANGE; i++) {
                const r = bomb.r + dr * i;
                const c = bomb.c + dc * i;
                const ch = state.cells[r][c];
                if (ch === '#') break;
                if (ch === 'B') {
                    state.cells[r][c] = ' ';
                    if (state.exit[0] === r && state.exit[1] === c) state.exitOpen = true;
                    burn(r, c);
                    break;
                }
                burn(r, c);
                const other = state.bombs.find(b => b.r === r && b.c === c);
                if (other) this.explode(state, other); // chain reaction
            }
        });
    },

    applyFlames(state) {
        state.enemies = state.enemies.filter(e => !state.flames.has(`${e.r},${e.c}`));
        if (state.flames.has(`${state.player[0]},${state.player[1]}`)) state.dead = true;
    },

    moveEnemies(state) {
        if (state.tick % 2 !== 0) return;
        state.enemies.forEach(e => {
            const free = dir => {
                const [dr, dc] = this.directions[dir];
                const r = e.r + dr;
                const c = e.c + dc;
                return state.cells[r][c] === ' ' && !this.bombAt(state, r, c) && this.enemyAt(state, r, c) < 0;
            };
            const options = Object.keys(this.directions).filter(free);
            if (!options.length) return;
            if (!free(e.dir) || state.rand() < 0.15) e.dir = options[Math.floor(state.rand() * options.length)];
            const [dr, dc] = this.directions[e.dir];
            e.r += dr;
            e.c += dc;
        });
        if (this.enemyAt(state, ...state.player) >= 0) state.dead = true;
    },

    step(state, action) {
        if (state.dead || state.cleared) return state;
        state.tick++;
        if (action === 'bomb') this.placeBomb(state);
        else if (action) this.movePlayer(state, action);
        if (this.enemyAt(state, ...state.player) >= 0) state.dead = true;
        // flames fade, bombs tick down
        state.flames.forEach((ttl, key) => { if (ttl <= 1) state.flames.delete(key); else state.flames.set(key, ttl - 1); });
        state.bombs.slice().forEach(b => { b.timer--; if (b.timer <= 0 && state.bombs.includes(b)) this.explode(state, b); });
        this.applyFlames(state);
        if (!state.dead) this.moveEnemies(state);
        if (!state.dead && state.exitOpen && !state.enemies.length && state.player[0] === state.exit[0] && state.player[1] === state.exit[1]) state.cleared = true;
        return state;
    }
};
