/**
 * Lemmings-lite. Lemmings drop out of the door one by one and walk mindlessly:
 * they turn at walls, step up single steps, and fall off edges (a long fall
 * is fatal). Give them skills to guide enough of them to the exit:
 *   blocker  stands still and turns walkers around
 *   digger   digs straight down through earth
 *   builder  builds a short diagonal staircase forward and up
 *   basher   digs a tunnel forward through earth
 *   bomber   explodes after a moment, blasting the earth around it
 * Map: '#' earth (diggable), 'X' steel, '.' air, 'D' door, 'E' exit.
 */
const LemmingsEngine = {
    MAX_FALL: 6,
    SPAWN_EVERY: 8,
    BUILD_STEPS: 6,
    BOMB_TICKS: 4,

    parse(level) {
        const cells = level.map.map(row => [...row]);
        const height = cells.length;
        const width = Math.max(...cells.map(r => r.length));
        cells.forEach(row => { while (row.length < width) row.push('#'); });
        let door = null;
        let exit = null;
        cells.forEach((row, y) => row.forEach((ch, x) => {
            if (ch === 'D') { door = { x, y }; row[x] = '.'; }
            if (ch === 'E') { exit = { x, y }; }
        }));
        return {
            width, height, cells, door, exit, lemmings: [], toSpawn: level.lemmings, total: level.lemmings, required: level.required,
            skills: { ...level.skills }, saved: 0, dead: 0, tick: 0, finished: false, won: false
        };
    },

    at(state, x, y) {
        if (x < 0 || y < 0 || x >= state.width || y >= state.height) return 'X';
        return state.cells[y][x];
    },

    solid(ch) {
        return ch === '#' || ch === 'X';
    },

    blockerAt(state, x, y) {
        return state.lemmings.some(l => l.alive && l.state === 'block' && l.x === x && l.y === y);
    },

    // Gives a skill to the first suitable lemming in the cell; returns true when applied
    assign(state, x, y, skill) {
        if (!state.skills[skill]) return false;
        const lem = state.lemmings.find(l => l.alive && l.x === x && l.y === y && (l.state === 'walk' || (skill === 'bomber' && l.state !== 'bomb')));
        if (!lem) return false;
        if (skill === 'bomber') { lem.state = 'bomb'; lem.timer = this.BOMB_TICKS; }
        else if (skill === 'blocker') lem.state = 'block';
        else if (skill === 'digger') lem.state = 'dig';
        else if (skill === 'basher') lem.state = 'bash';
        else if (skill === 'builder') { lem.state = 'build'; lem.timer = this.BUILD_STEPS; }
        else return false;
        state.skills[skill]--;
        return true;
    },

    spawn(state) {
        if (state.toSpawn <= 0 || state.tick % this.SPAWN_EVERY !== 1) return;
        state.lemmings.push({ x: state.door.x, y: state.door.y, dir: 1, state: 'walk', timer: 0, fall: 0, alive: true });
        state.toSpawn--;
    },

    kill(state, lem) {
        lem.alive = false;
        state.dead++;
    },

    stepLemming(state, lem) {
        const below = this.at(state, lem.x, lem.y + 1);
        // gravity applies to everyone except blockers and bombers mid-count
        if (!this.solid(below) && lem.state !== 'block' && lem.state !== 'bomb') {
            lem.y += 1;
            lem.fall += 1;
            if (lem.state !== 'fall' && lem.state !== 'build') { lem.state = 'fall'; }
            if (lem.state === 'build') lem.state = 'fall';
            return;
        }
        if (lem.state === 'fall') {
            if (lem.fall > this.MAX_FALL) { this.kill(state, lem); return; }
            lem.fall = 0;
            lem.state = 'walk';
            return;
        }
        lem.fall = 0;
        switch (lem.state) {
            case 'walk': this.walk(state, lem); break;
            case 'dig': {
                if (below === '#') { state.cells[lem.y + 1][lem.x] = '.'; lem.y += 1; }
                else lem.state = 'walk';
                break;
            }
            case 'bash': {
                const ahead = this.at(state, lem.x + lem.dir, lem.y);
                const aheadUp = this.at(state, lem.x + lem.dir, lem.y - 1);
                if (ahead === '#' || aheadUp === '#') {
                    if (ahead === '#') state.cells[lem.y][lem.x + lem.dir] = '.';
                    if (aheadUp === '#') state.cells[lem.y - 1][lem.x + lem.dir] = '.';
                    lem.x += lem.dir;
                } else if (ahead === 'X') { lem.dir = -lem.dir; lem.state = 'walk'; }
                else lem.state = 'walk';
                break;
            }
            case 'build': {
                const nx = lem.x + lem.dir;
                if (lem.timer <= 0 || this.solid(this.at(state, nx, lem.y)) || this.solid(this.at(state, nx, lem.y - 1)) || this.solid(this.at(state, lem.x, lem.y - 1))) {
                    lem.state = 'walk';
                    break;
                }
                state.cells[lem.y][nx] = '#';
                lem.x = nx;
                lem.y -= 1;
                lem.timer--;
                break;
            }
            case 'bomb': {
                lem.timer--;
                if (lem.timer <= 0) {
                    for (let dy = -1; dy <= 2; dy++) for (let dx = -1; dx <= 1; dx++) {
                        if (this.at(state, lem.x + dx, lem.y + dy) === '#') state.cells[lem.y + dy][lem.x + dx] = '.';
                    }
                    this.kill(state, lem);
                }
                break;
            }
            case 'block': break;
        }
    },

    walk(state, lem) {
        const nx = lem.x + lem.dir;
        const ahead = this.at(state, nx, lem.y);
        if (this.blockerAt(state, nx, lem.y) || this.blockerAt(state, nx, lem.y - 1)) { lem.dir = -lem.dir; return; }
        if (!this.solid(ahead)) { lem.x = nx; return; }
        // one step up is fine when there is head room
        if (!this.solid(this.at(state, nx, lem.y - 1)) && !this.solid(this.at(state, lem.x, lem.y - 1))) { lem.x = nx; lem.y -= 1; return; }
        lem.dir = -lem.dir;
    },

    step(state, action) {
        if (state.finished) return state;
        state.tick++;
        if (action) this.assign(state, action.x, action.y, action.skill);
        this.spawn(state);
        state.lemmings.forEach(lem => {
            if (!lem.alive) return;
            this.stepLemming(state, lem);
            // only a lemming on its feet walks into the exit; one still falling past it is not saved
            if (lem.alive && lem.state === 'walk' && lem.x === state.exit.x && lem.y === state.exit.y) { lem.alive = false; lem.saved = true; state.saved++; }
        });
        // blockers never leave on their own, so the level ends once only blockers are left
        if (state.toSpawn === 0 && !state.lemmings.some(l => l.alive && l.state !== 'block')) {
            state.finished = true;
            state.won = state.saved >= state.required;
        }
        return state;
    }
};
