/**
 * Blink rules. Levels are text maps:
 *   #  wall        @  player       X  exit        (space) floor
 *   ~  chasm: you can't walk over it, but the teleport beam flies across
 *   o  crystal: blocks walking; the beam swaps you with it
 *   1 2 3  portal pads, in pairs: walking onto one moves you to its twin,
 *          and a beam entering one comes out of the twin in the same direction
 *   a b c  pressure plates      A B C  doors
 * A door is open while every plate with its letter holds the player or a crystal.
 * Crystals can't be pushed; the only way to move one is to swap places with it.
 */
const BlinkEngine = {
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
        const pads = {};
        const crystals = [];
        let player = null;
        for (let r = 0; r < height; r++) {
            tiles.push([]);
            for (let c = 0; c < width; c++) {
                let ch = level.map[r][c] ?? '#';
                if (ch === '@') { player = [r, c]; ch = ' '; }
                if (ch === 'o') { crystals.push([r, c]); ch = ' '; }
                if (/[a-z]/.test(ch)) (plates[ch] = plates[ch] || []).push([r, c]);
                if (/[1-9]/.test(ch)) (pads[ch] = pads[ch] || []).push([r, c]);
                tiles[r][c] = ch;
            }
        }
        return { width, height, tiles, plates, pads, state: { player, crystals } };
    },

    tile(puzzle, r, c) {
        return puzzle.tiles[r]?.[c] ?? '#';
    },

    isDoor(ch) {
        return /[A-Z]/.test(ch) && ch !== 'X';
    },

    crystalAt(state, r, c) {
        return state.crystals.findIndex(([cr, cc]) => cr === r && cc === c);
    },

    pressed(state, r, c) {
        return (state.player[0] === r && state.player[1] === c) || this.crystalAt(state, r, c) >= 0;
    },

    doorOpen(puzzle, state, letter) {
        const plates = puzzle.plates[letter.toLowerCase()] || [];
        return plates.length > 0 && plates.every(([r, c]) => this.pressed(state, r, c));
    },

    // The other pad of a portal pair
    twin(puzzle, r, c) {
        const pair = puzzle.pads[this.tile(puzzle, r, c)] || [];
        return pair.find(([pr, pc]) => pr !== r || pc !== c) || null;
    },

    // Walks one step. Returns { state, teleported } or { blocked: reason }
    move(puzzle, state, dir) {
        const [dr, dc] = this.directions[dir];
        const r = state.player[0] + dr;
        const c = state.player[1] + dc;
        const ch = this.tile(puzzle, r, c);
        if (ch === '#') return { blocked: 'wall' };
        if (ch === '~') return { blocked: 'chasm' };
        if (this.crystalAt(state, r, c) >= 0) return { blocked: 'crystal' };
        if (this.isDoor(ch) && !this.doorOpen(puzzle, state, ch)) return { blocked: 'door' };

        let player = [r, c];
        let teleported = false;
        const twin = /[1-9]/.test(ch) ? this.twin(puzzle, r, c) : null;
        if (twin && this.crystalAt(state, ...twin) < 0) {
            player = twin;
            teleported = true;
        }
        return { state: { player, crystals: state.crystals }, teleported };
    },

    /**
     * Follows the teleport beam from the player. Returns the cells it crossed
     * (as segments, split where it goes through a portal) and the index of the
     * crystal it hit, if any.
     */
    trace(puzzle, state, dir) {
        const [dr, dc] = this.directions[dir];
        let [r, c] = state.player;
        const segments = [[[r, c]]];
        for (let steps = 0; steps < 200; steps++) {
            r += dr;
            c += dc;
            const ch = this.tile(puzzle, r, c);
            if (ch === '#' || (this.isDoor(ch) && !this.doorOpen(puzzle, state, ch))) {
                segments[segments.length - 1].push([r, c]);
                return { segments, hit: -1 };
            }
            segments[segments.length - 1].push([r, c]);
            let idx = this.crystalAt(state, r, c);
            if (idx >= 0) return { segments, hit: idx };
            const twin = /[1-9]/.test(ch) ? this.twin(puzzle, r, c) : null;
            if (twin) {
                [r, c] = twin;
                segments.push([[r, c]]);
                idx = this.crystalAt(state, r, c);
                if (idx >= 0) return { segments, hit: idx };
            }
        }
        return { segments, hit: -1 };
    },

    // Fires the beam; on a hit the player and the crystal trade places
    blink(puzzle, state, dir) {
        const beam = this.trace(puzzle, state, dir);
        if (beam.hit < 0) return { blocked: 'nothing', beam };
        const crystals = state.crystals.map(p => [...p]);
        const player = crystals[beam.hit];
        crystals[beam.hit] = [...state.player];
        return { state: { player, crystals }, beam };
    },

    isSolved(puzzle, state) {
        return this.tile(puzzle, ...state.player) === 'X';
    },

    key(state) {
        return state.player.join(',') + '|' + state.crystals.map(p => p.join(',')).sort().join(';');
    }
};
