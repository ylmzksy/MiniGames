/**
 * Snake. Steer the snake to the food; each bite makes it longer. Hitting a
 * wall, an obstacle or your own body ends the run. A level is cleared when
 * the snake reaches the target length. Turns are queued so quick double
 * turns are honored one per tick.
 */
const SnakeEngine = {
    directions: { up: [-1, 0], down: [1, 0], left: [0, -1], right: [0, 1] },
    opposite: { up: 'down', down: 'up', left: 'right', right: 'left' },

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
        const walls = new Set();
        (level.walls || []).forEach((row, r) => [...row].forEach((ch, c) => { if (ch === '#') walls.add(`${r},${c}`); }));
        const mid = [Math.floor(level.height / 2), Math.floor(level.width / 2)];
        const snake = [mid, [mid[0], mid[1] - 1], [mid[0], mid[1] - 2]];
        const state = { width: level.width, height: level.height, walls, snake, dir: 'right', queue: [], food: null, grow: 0, target: level.target, dead: false, cleared: false, rand };
        this.placeFood(state);
        return state;
    },

    occupied(state, r, c) {
        return state.snake.some(([sr, sc]) => sr === r && sc === c);
    },

    placeFood(state) {
        const free = [];
        for (let r = 0; r < state.height; r++) for (let c = 0; c < state.width; c++) {
            if (!state.walls.has(`${r},${c}`) && !this.occupied(state, r, c)) free.push([r, c]);
        }
        state.food = free.length ? free[Math.floor(state.rand() * free.length)] : null;
    },

    // Queues a turn; a reversal of the last queued direction is ignored
    turn(state, dir) {
        const last = state.queue.length ? state.queue[state.queue.length - 1] : state.dir;
        if (dir === last || dir === this.opposite[last]) return;
        if (state.queue.length < 2) state.queue.push(dir);
    },

    step(state) {
        if (state.dead || state.cleared) return state;
        if (state.queue.length) state.dir = state.queue.shift();
        const [dr, dc] = this.directions[state.dir];
        const [hr, hc] = state.snake[0];
        const nr = hr + dr;
        const nc = hc + dc;
        // the tail cell frees up this tick unless the snake is growing
        const lastIdx = state.snake.length - 1;
        const bodyHit = state.snake.some(([r, c], i) => r === nr && c === nc && !(i === lastIdx && state.grow === 0));
        if (nr < 0 || nc < 0 || nr >= state.height || nc >= state.width || state.walls.has(`${nr},${nc}`) || bodyHit) {
            state.dead = true;
            return state;
        }
        state.snake.unshift([nr, nc]);
        if (state.food && state.food[0] === nr && state.food[1] === nc) {
            state.grow += 1;
            this.placeFood(state);
        }
        if (state.grow > 0) state.grow--; else state.snake.pop();
        if (state.snake.length >= state.target) state.cleared = true;
        return state;
    }
};
