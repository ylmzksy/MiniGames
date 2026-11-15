/**
 * Time Loop rules. Levels are text maps:
 *   #  wall        @  start        X  exit        (space) floor
 *   a b c  pressure plates      A B C  doors
 * A door is open while every plate with its letter has someone standing on it.
 *
 * Time moves one tick per action (a step or a wait). Rewinding sends the player
 * back to the start at time 0; the actions of that run become an echo that
 * replays them exactly, next to the new run. An echo exists from time 0 until
 * the moment it rewound (its last action), then it is gone.
 *
 * Nobody can step onto a wall, a closed door or a tile someone stands on.
 * Within a tick the newest run moves first, then the echoes from newest to
 * oldest, which is the same order they had while being recorded. So the only
 * way to change the past is to get in an echo's way: if an echo cannot do
 * its recorded step, the timeline breaks (a paradox) and the action is refused.
 */
const TimeLoopEngine = {
    directions: {
        up: [-1, 0],
        down: [1, 0],
        left: [0, -1],
        right: [0, 1]
    },

    parse(level) {
        const height = level.map.length;
        const width = Math.max(...level.map.map(row => row.length));
        const tiles = [];
        const plates = {};
        let start = null;
        let exit = null;
        for (let r = 0; r < height; r++) {
            tiles.push([]);
            for (let c = 0; c < width; c++) {
                const ch = level.map[r][c] ?? '#';
                tiles[r][c] = ch;
                if (ch === '@') start = [r, c];
                if (ch === 'X') exit = [r, c];
                if (/[a-z]/.test(ch)) (plates[ch] = plates[ch] || []).push([r, c]);
            }
        }
        return { width, height, tiles, plates, start, exit, maxEchoes: level.echoes };
    },

    isDoor(ch) {
        return /[A-Z]/.test(ch) && ch !== 'X';
    },

    occupied(entities, r, c, except) {
        return entities.some(e => e !== except && e.present && e.pos[0] === r && e.pos[1] === c);
    },

    doorOpen(puzzle, entities, letter) {
        const plates = puzzle.plates[letter.toLowerCase()] || [];
        return plates.length > 0 && plates.every(([r, c]) => this.occupied(entities, r, c));
    },

    // Why `entity` cannot step in `dir` right now, or null if it can
    blockReason(puzzle, entities, entity, dir) {
        const [dr, dc] = this.directions[dir];
        const r = entity.pos[0] + dr;
        const c = entity.pos[1] + dc;
        const ch = puzzle.tiles[r]?.[c] ?? '#';
        if (ch === '#') return 'wall';
        if (this.isDoor(ch) && !this.doorOpen(puzzle, entities, ch)) return 'door';
        if (this.occupied(entities, r, c, entity)) return 'occupied';
        return null;
    },

    /**
     * Replays every run from time 0. `echoes` holds the action lists of the
     * earlier runs (oldest first); `actions` is the current run.
     * Actions are 'up' | 'down' | 'left' | 'right' | 'wait'.
     * Returns the world at the end of `actions`, or an error at the first
     * tick that cannot happen.
     */
    simulate(puzzle, echoes, actions) {
        const entities = [...echoes, actions].map((list, idx) => ({
            idx,
            actions: list,
            isPlayer: idx === echoes.length,
            pos: [...puzzle.start],
            present: true
        }));
        const player = entities[entities.length - 1];
        const order = [...entities].reverse();

        for (let t = 0; t < actions.length; t++) {
            // An echo is gone once it has played its last action
            entities.forEach(e => { e.present = e.isPlayer || t < e.actions.length; });
            for (const e of order) {
                if (!e.present) continue;
                const action = e.actions[t];
                if (action === 'wait') continue;
                const reason = this.blockReason(puzzle, entities, e, action);
                if (reason) {
                    return e.isPlayer
                        ? { error: 'blocked', reason, time: t }
                        : { error: 'paradox', echo: e.idx, time: t };
                }
                const [dr, dc] = this.directions[action];
                e.pos = [e.pos[0] + dr, e.pos[1] + dc];
            }
        }

        const time = actions.length;
        entities.forEach(e => { e.present = e.isPlayer || time < e.actions.length; });
        const won = player.pos[0] === puzzle.exit[0] && player.pos[1] === puzzle.exit[1];
        return {
            time,
            won,
            player: player.pos,
            echoes: entities.filter(e => !e.isPlayer).map(e => ({
                idx: e.idx,
                pos: e.pos,
                present: e.present,
                next: e.present ? e.actions[time] : null
            })),
            entities
        };
    },

    // Letters of the doors that are open in a simulated world
    openDoors(puzzle, world) {
        return Object.keys(puzzle.plates)
            .map(p => p.toUpperCase())
            .filter(letter => this.doorOpen(puzzle, world.entities, letter));
    }
};
