/**
 * Chip's Challenge style. Collect every chip to open the socket, find keys
 * for colored doors, pick up flippers to swim and fire boots to walk through
 * fire, slide across ice, ride force floors, push blocks (into water to fill
 * it), avoid the bugs, and reach the exit.
 * Map: '#' wall, '.' floor, 'C' chip, 'S' socket, 'r','g','b','y' keys,
 *      'R','G','B','Y' doors, '~' water, 'F' fire, 'I' ice, '<' '>' 'v' 'A'
 *      force floors (A = up), 'O' block, 'M' bug, 'f' flippers, 'o' fire
 *      boots, 'X' exit, 'P' you. The game advances in ticks.
 */
const ChipsEngine = {
    directions: { up: [-1, 0], down: [1, 0], left: [0, -1], right: [0, 1] },
    FORCE: { '<': 'left', '>': 'right', 'v': 'down', 'A': 'up' },
    BUG_EVERY: 2,

    parse(level) {
        const cells = level.map.map(row => [...row]);
        const height = cells.length;
        const width = Math.max(...cells.map(r => r.length));
        cells.forEach(row => { while (row.length < width) row.push('#'); });
        let player = null;
        const bugs = [];
        let chips = 0;
        cells.forEach((row, r) => row.forEach((ch, c) => {
            if (ch === 'P') { player = { r, c }; row[c] = '.'; }
            else if (ch === 'M') { bugs.push({ r, c, dir: 'left' }); row[c] = '.'; }
            else if (ch === 'C') chips++;
        }));
        return { width, height, cells, player, bugs, chips, keys: { r: 0, g: 0, b: 0, y: 0 }, flippers: false, boots: false, sliding: null, tick: 0, dead: false, won: false, lastDir: 'down' };
    },

    at(state, r, c) {
        if (r < 0 || c < 0 || r >= state.height || c >= state.width) return '#';
        return state.cells[r][c];
    },

    bugAt(state, r, c) {
        return state.bugs.findIndex(b => b.r === r && b.c === c);
    },

    // Tries to move the player one cell; returns true if it moved
    move(state, dir) {
        const [dr, dc] = this.directions[dir];
        const { r, c } = state.player;
        const nr = r + dr;
        const nc = c + dc;
        const t = this.at(state, nr, nc);
        state.lastDir = dir;
        if (t === '#') return false;
        if ('RGBY'.includes(t)) {
            const key = t.toLowerCase();
            if (state.keys[key] <= 0) return false;
            state.keys[key]--;
            state.cells[nr][nc] = '.';
        } else if (t === 'S') {
            if (state.chips > 0) return false;
            state.cells[nr][nc] = '.';
        } else if (t === 'O') {
            const br = nr + dr;
            const bc = nc + dc;
            const beyond = this.at(state, br, bc);
            if ((beyond !== '.' && beyond !== '~') || this.bugAt(state, br, bc) >= 0) return false;
            state.cells[br][bc] = beyond === '~' ? '.' : 'O';
            state.cells[nr][nc] = '.';
        }
        state.player = { r: nr, c: nc };
        if (this.bugAt(state, nr, nc) >= 0) { state.dead = true; return true; }
        this.enter(state, dir);
        return true;
    },

    // Effects of the tile the player just stepped on
    enter(state, dir) {
        const { r, c } = state.player;
        const t = state.cells[r][c];
        state.sliding = null;
        if (t === 'C') { state.cells[r][c] = '.'; state.chips--; }
        else if ('rgby'.includes(t)) { state.keys[t]++; state.cells[r][c] = '.'; }
        else if (t === 'f') { state.flippers = true; state.cells[r][c] = '.'; }
        else if (t === 'o') { state.boots = true; state.cells[r][c] = '.'; }
        else if (t === '~') { if (!state.flippers) state.dead = true; }
        else if (t === 'F') { if (!state.boots) state.dead = true; }
        else if (t === 'X') state.won = true;
        else if (t === 'I') state.sliding = dir;
        else if (this.FORCE[t]) state.sliding = this.FORCE[t];
    },

    moveBugs(state) {
        if (state.tick % this.BUG_EVERY !== 0) return;
        state.bugs.forEach(b => {
            const [dr, dc] = this.directions[b.dir];
            const nr = b.r + dr;
            const nc = b.c + dc;
            const t = this.at(state, nr, nc);
            const free = (t === '.' || t === 'I') && this.bugAt(state, nr, nc) < 0;
            if (!free) {
                b.dir = { left: 'right', right: 'left', up: 'down', down: 'up' }[b.dir];
                return;
            }
            b.r = nr;
            b.c = nc;
            if (state.player.r === nr && state.player.c === nc) state.dead = true;
        });
    },

    // A full tick: slide if sliding, else the player's move; then the bugs
    step(state, dir) {
        if (state.dead || state.won) return state;
        state.tick++;
        if (state.sliding) {
            const slideDir = state.sliding;
            if (!this.move(state, slideDir)) state.sliding = null;
        } else if (dir) {
            this.move(state, dir);
        }
        if (!state.dead && !state.won) this.moveBugs(state);
        return state;
    }
};
