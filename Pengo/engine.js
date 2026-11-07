/**
 * Pengo. A frozen maze of ice blocks with Sno-Bees wandering the gaps. Push a
 * block and it slides until it hits something, crushing any Sno-Bee in its
 * way; a block that cannot slide shatters instead. Crush every Sno-Bee to
 * win; touching one is fatal. Cells: '#' wall, 'I' ice block, ' ' floor.
 */
const PengoEngine = {
    directions: { up: [-1, 0], down: [1, 0], left: [0, -1], right: [0, 1] },

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
                cells[r][c] = border ? '#' : (rand() < level.blocks ? 'I' : ' ');
            }
        }
        const player = [Math.floor(height / 2), Math.floor(width / 2)];
        cells[player[0]][player[1]] = ' ';
        // Sno-Bees in far floor cells
        const far = [];
        for (let r = 1; r < height - 1; r++) for (let c = 1; c < width - 1; c++) {
            if (cells[r][c] === ' ' && Math.abs(r - player[0]) + Math.abs(c - player[1]) >= 5) far.push([r, c]);
        }
        far.sort(() => rand() - 0.5);
        const enemies = far.slice(0, level.enemies).map(([r, c]) => ({ r, c, dir: 'up' }));
        return { width, height, cells, player, enemies, sliding: [], tick: 0, crushed: 0, dead: false, cleared: false, rand };
    },

    enemyAt(state, r, c) {
        return state.enemies.findIndex(e => e.r === r && e.c === c);
    },

    slidingAt(state, r, c) {
        return state.sliding.some(b => b.r === r && b.c === c);
    },

    movePlayer(state, dir) {
        const [dr, dc] = this.directions[dir];
        const [r, c] = state.player;
        const nr = r + dr;
        const nc = c + dc;
        const target = state.cells[nr][nc];
        if (target === '#' || this.slidingAt(state, nr, nc)) return;
        if (target === 'I') {
            const br = nr + dr;
            const bc = nc + dc;
            if (state.cells[br][bc] === ' ' && !this.slidingAt(state, br, bc)) {
                state.cells[nr][nc] = ' ';
                state.sliding.push({ r: nr, c: nc, dr, dc });
                state.cells[nr][nc] = 'S'; // sliding block occupies its cell
            } else {
                state.cells[nr][nc] = ' '; // a stuck block shatters
            }
            return;
        }
        if (target !== ' ') return;
        state.player = [nr, nc];
        if (this.enemyAt(state, nr, nc) >= 0) state.dead = true;
    },

    moveBlocks(state) {
        state.sliding.slice().forEach(b => {
            const nr = b.r + b.dr;
            const nc = b.c + b.dc;
            const ahead = state.cells[nr][nc];
            const stop = ahead !== ' ' || (state.player[0] === nr && state.player[1] === nc);
            if (stop) {
                state.cells[b.r][b.c] = 'I';
                state.sliding = state.sliding.filter(x => x !== b);
                return;
            }
            state.cells[b.r][b.c] = ' ';
            b.r = nr;
            b.c = nc;
            state.cells[nr][nc] = 'S';
            const hit = this.enemyAt(state, nr, nc);
            if (hit >= 0) { state.enemies.splice(hit, 1); state.crushed++; }
        });
    },

    moveEnemies(state) {
        if (state.tick % 2 !== 0) return;
        state.enemies.forEach(e => {
            const free = dir => {
                const [dr, dc] = this.directions[dir];
                return state.cells[e.r + dr][e.c + dc] === ' ' && this.enemyAt(state, e.r + dr, e.c + dc) < 0;
            };
            const options = Object.keys(this.directions).filter(free);
            if (!options.length) return;
            if (!free(e.dir) || state.rand() < 0.2) e.dir = options[Math.floor(state.rand() * options.length)];
            const [dr, dc] = this.directions[e.dir];
            e.r += dr;
            e.c += dc;
        });
        if (this.enemyAt(state, ...state.player) >= 0) state.dead = true;
    },

    step(state, action) {
        if (state.dead || state.cleared) return state;
        state.tick++;
        if (action) this.movePlayer(state, action);
        this.moveBlocks(state);
        if (!state.dead) this.moveEnemies(state);
        if (!state.dead && !state.enemies.length) state.cleared = true;
        return state;
    }
};
