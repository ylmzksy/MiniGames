/**
 * Rodent's Revenge. You are the mouse. Cats chase you through the gaps between
 * blocks; you push blocks (whole rows of them, if there is room behind) to wall
 * the cats in. A cat that cannot move for a while turns into cheese, which you
 * can eat. The level is won when no cat is left. Touching a cat ends the game.
 * Map: '#' steel wall, 'B' block, '.' floor, 'M' mouse, 'C' cat, 'H' cheese.
 */
const RodentEngine = {
    directions: { up: [-1, 0], down: [1, 0], left: [0, -1], right: [0, 1] },
    STUCK_TICKS: 6,
    CAT_EVERY: 2,

    parse(level) {
        const cells = level.map.map(row => [...row]);
        const cats = [];
        let mouse = null;
        cells.forEach((row, r) => row.forEach((ch, c) => {
            if (ch === 'M') { mouse = [r, c]; row[c] = '.'; }
            if (ch === 'C') { cats.push({ r, c, stuck: 0 }); row[c] = '.'; }
        }));
        return { width: cells[0].length, height: cells.length, cells, mouse, cats, tick: 0, score: 0, dead: false, won: false, seed: (level.seed || 1) >>> 0 };
    },

    clone(state) {
        return { ...state, cells: state.cells.map(row => [...row]), mouse: [...state.mouse], cats: state.cats.map(c => ({ ...c })) };
    },

    random(state) {
        state.seed = (state.seed + 0x6D2B79F5) >>> 0;
        let t = state.seed;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },

    catAt(state, r, c) {
        return state.cats.findIndex(k => k.r === r && k.c === c);
    },

    moveMouse(state, dir) {
        const [dr, dc] = this.directions[dir];
        const [r, c] = state.mouse;
        let nr = r + dr;
        let nc = c + dc;
        const target = state.cells[nr]?.[nc];
        if (target === undefined || target === '#') return false;
        if (target === 'B') {
            // push the whole line of blocks if there is floor at its end
            let er = nr;
            let ec = nc;
            while (state.cells[er]?.[ec] === 'B') { er += dr; ec += dc; }
            const end = state.cells[er]?.[ec];
            if (end !== '.' && end !== 'H') return false;
            if (this.catAt(state, er, ec) >= 0) return false;
            state.cells[er][ec] = 'B';
            state.cells[nr][nc] = '.';
        } else if (target === 'H') {
            state.cells[nr][nc] = '.';
            state.score += 100;
        }
        if (this.catAt(state, nr, nc) >= 0) state.dead = true;
        state.mouse = [nr, nc];
        return true;
    },

    // Shortest floor distances from the mouse, for the cats
    distances(state) {
        const dist = Array.from({ length: state.height }, () => Array(state.width).fill(Infinity));
        const queue = [state.mouse];
        dist[state.mouse[0]][state.mouse[1]] = 0;
        for (let head = 0; head < queue.length; head++) {
            const [r, c] = queue[head];
            Object.values(this.directions).forEach(([dr, dc]) => {
                const nr = r + dr;
                const nc = c + dc;
                const ch = state.cells[nr]?.[nc];
                if ((ch !== '.' && ch !== 'H') || dist[nr][nc] !== Infinity) return;
                dist[nr][nc] = dist[r][c] + 1;
                queue.push([nr, nc]);
            });
        }
        return dist;
    },

    catOptions(state, cat) {
        return Object.values(this.directions)
            .map(([dr, dc]) => [cat.r + dr, cat.c + dc])
            .filter(([r, c]) => { const ch = state.cells[r]?.[c]; return (ch === '.' || ch === 'H') && this.catAt(state, r, c) < 0; });
    },

    moveCats(state) {
        const dist = this.distances(state);
        state.cats.forEach(cat => {
            const options = this.catOptions(state, cat);
            if (!options.length) { cat.stuck++; return; }
            cat.stuck = 0;
            const best = options.reduce((a, b) => dist[b[0]][b[1]] < dist[a[0]][a[1]] ? b : a, options[0]);
            const pick = dist[best[0]][best[1]] === Infinity || this.random(state) < 0.1 ? options[Math.floor(this.random(state) * options.length)] : best;
            cat.r = pick[0];
            cat.c = pick[1];
            if (cat.r === state.mouse[0] && cat.c === state.mouse[1]) state.dead = true;
        });
    },

    // Cats stuck long enough become cheese
    ripen(state) {
        state.cats = state.cats.filter(cat => {
            if (cat.stuck < this.STUCK_TICKS) return true;
            state.cells[cat.r][cat.c] = 'H';
            state.score += 250;
            return false;
        });
    },

    step(state, dir) {
        if (state.dead || state.won) return state;
        state.tick++;
        if (dir) this.moveMouse(state, dir);
        if (!state.dead && state.tick % this.CAT_EVERY === 0) {
            this.moveCats(state);
            this.ripen(state);
        }
        if (!state.dead && !state.cats.length) state.won = true;
        return state;
    }
};
