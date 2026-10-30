/**
 * Boulder Dash. Dig through dirt, collect diamonds, then reach the exit.
 * Boulders and diamonds fall when nothing is under them and roll off round
 * things (other boulders, diamonds, walls). A falling object that lands on
 * the player is fatal. Boulders can be pushed sideways into empty space.
 * Map: '#' steel wall, '.' dirt, ' ' empty, 'O' boulder, '*' diamond,
 *      'R' the player, 'X' the exit (opens once enough diamonds are collected).
 * The game advances in ticks: the player's move first, then the physics.
 */
const BoulderEngine = {
    directions: { up: [-1, 0], down: [1, 0], left: [0, -1], right: [0, 1] },

    parse(level) {
        const cells = level.map.map(row => [...row]);
        const height = cells.length;
        const width = Math.max(...cells.map(r => r.length));
        cells.forEach(row => { while (row.length < width) row.push(' '); });
        let player = null;
        cells.forEach((row, r) => row.forEach((ch, c) => { if (ch === 'R') player = [r, c]; }));
        return { width, height, cells, player, needed: level.diamonds, collected: 0, falling: new Set(), dead: false, exited: false };
    },

    clone(state) {
        return { ...state, cells: state.cells.map(row => [...row]), player: [...state.player], falling: new Set(state.falling) };
    },

    isOpen(state) {
        return state.collected >= state.needed;
    },

    // Tries to move the player; returns true when something happened
    move(state, dir) {
        if (state.dead || state.exited) return false;
        const [dr, dc] = this.directions[dir];
        const [r, c] = state.player;
        const nr = r + dr;
        const nc = c + dc;
        const target = state.cells[nr]?.[nc];
        if (target === undefined || target === '#') return false;
        if (target === 'O') {
            // boulders are pushed sideways into empty space, never while falling
            if (dr !== 0 || state.cells[nr][nc + dc] !== ' ' || state.falling.has(`${nr},${nc}`)) return false;
            state.cells[nr][nc + dc] = 'O';
        } else if (target === '*') {
            state.collected++;
        } else if (target === 'X') {
            if (!this.isOpen(state)) return false;
            state.exited = true;
        }
        state.cells[r][c] = ' ';
        state.cells[nr][nc] = 'R';
        state.player = [nr, nc];
        return true;
    },

    isRound(ch) {
        return ch === 'O' || ch === '*' || ch === '#';
    },

    // One tick of gravity, scanned bottom-up so stacks fall together
    physics(state) {
        const falling = new Set();
        const moved = new Set();
        const { cells } = state;
        for (let r = state.height - 2; r >= 0; r--) {
            for (let c = 0; c < state.width; c++) {
                const ch = cells[r][c];
                if ((ch !== 'O' && ch !== '*') || moved.has(`${r},${c}`)) continue;
                const below = cells[r + 1][c];
                const wasFalling = state.falling.has(`${r},${c}`);
                const drop = (nr, nc) => {
                    cells[r][c] = ' ';
                    cells[nr][nc] = ch;
                    falling.add(`${nr},${nc}`);
                    moved.add(`${nr},${nc}`);
                };
                if (below === ' ') {
                    drop(r + 1, c);
                } else if (below === 'R' && wasFalling) {
                    state.dead = true;
                } else if (this.isRound(below)) {
                    if (cells[r][c - 1] === ' ' && cells[r + 1][c - 1] === ' ') drop(r, c - 1);
                    else if (cells[r][c + 1] === ' ' && cells[r + 1][c + 1] === ' ') drop(r, c + 1);
                }
            }
        }
        state.falling = falling;
    },

    // A full tick: the player's move (if any), then the physics
    step(state, dir) {
        if (dir) this.move(state, dir);
        if (!state.exited) this.physics(state);
        return state;
    },

    diamondsLeft(state) {
        return state.cells.flat().filter(ch => ch === '*').length;
    }
};
