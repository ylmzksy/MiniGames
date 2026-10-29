/**
 * Sokobond rules. Atoms have a number of free electrons (H 1, O 2, N 3, C 4).
 * You steer one atom; everything bonded to it moves with it as a rigid unit,
 * and other molecules in the way are pushed. After a move, every atom of your
 * molecule bonds with any free atom next to it, using as many electrons as
 * both still have. The level is solved when all atoms form one molecule and
 * no free electrons remain.
 * Map: '#' wall, ' ' floor, H O N C atoms; the lowercase atom is the player.
 */
const SokobondEngine = {
    valence: { H: 1, O: 2, N: 3, C: 4 },
    directions: { up: [-1, 0], down: [1, 0], left: [0, -1], right: [0, 1] },

    parse(level) {
        const height = level.map.length;
        const width = Math.max(...level.map.map(row => row.length));
        const walls = [];
        const atoms = [];
        let player = -1;
        for (let r = 0; r < height; r++) {
            walls.push([]);
            for (let c = 0; c < width; c++) {
                const ch = level.map[r][c] ?? ' ';
                walls[r][c] = ch === '#';
                const element = ch.toUpperCase();
                if (this.valence[element]) {
                    if (ch !== element) player = atoms.length;
                    atoms.push({ element, pos: [r, c] });
                }
            }
        }
        return { width, height, walls, player, state: { atoms, bonds: {} } };
    },

    bondKey(a, b) {
        return a < b ? `${a}-${b}` : `${b}-${a}`;
    },

    // Bonds of atom i as [otherIndex, count] pairs
    bondsOf(state, i) {
        return Object.entries(state.bonds)
            .map(([key, n]) => [key.split('-').map(Number), n])
            .filter(([[a, b]]) => a === i || b === i)
            .map(([[a, b], n]) => [a === i ? b : a, n]);
    },

    freeElectrons(state, i) {
        const used = this.bondsOf(state, i).reduce((sum, [, n]) => sum + n, 0);
        return this.valence[state.atoms[i].element] - used;
    },

    // Indices of all atoms bonded (directly or indirectly) to atom i
    molecule(state, i) {
        const seen = new Set([i]);
        const queue = [i];
        while (queue.length) {
            const a = queue.shift();
            this.bondsOf(state, a).forEach(([b]) => {
                if (!seen.has(b)) { seen.add(b); queue.push(b); }
            });
        }
        return seen;
    },

    atomAt(state, r, c) {
        return state.atoms.findIndex(({ pos }) => pos[0] === r && pos[1] === c);
    },

    clone(state) {
        return { atoms: state.atoms.map(a => ({ element: a.element, pos: [...a.pos] })), bonds: { ...state.bonds } };
    },

    // Returns the new state, or null if a wall blocks the move
    move(puzzle, state, dir) {
        const [dr, dc] = this.directions[dir];
        const moving = new Set(this.molecule(state, puzzle.player));
        const queue = [...moving];
        while (queue.length) {
            const i = queue.shift();
            const [r, c] = state.atoms[i].pos;
            const nr = r + dr;
            const nc = c + dc;
            if (nr < 0 || nc < 0 || nr >= puzzle.height || nc >= puzzle.width || puzzle.walls[nr][nc]) return null;
            const other = this.atomAt(state, nr, nc);
            if (other >= 0 && !moving.has(other)) {
                this.molecule(state, other).forEach(j => { moving.add(j); queue.push(j); });
            }
        }

        const next = this.clone(state);
        moving.forEach(i => { next.atoms[i].pos = [next.atoms[i].pos[0] + dr, next.atoms[i].pos[1] + dc]; });
        this.formBonds(puzzle, next);
        return next;
    },

    // Bonds every atom of the player's molecule with free neighbors until nothing changes
    formBonds(puzzle, state) {
        let changed = true;
        while (changed) {
            changed = false;
            for (const i of this.molecule(state, puzzle.player)) {
                const freeI = this.freeElectrons(state, i);
                if (freeI <= 0) continue;
                const [r, c] = state.atoms[i].pos;
                for (const [dr, dc] of Object.values(this.directions)) {
                    const j = this.atomAt(state, r + dr, c + dc);
                    if (j < 0) continue;
                    const n = Math.min(this.freeElectrons(state, i), this.freeElectrons(state, j));
                    if (n <= 0) continue;
                    const key = this.bondKey(i, j);
                    state.bonds[key] = (state.bonds[key] || 0) + n;
                    changed = true;
                }
            }
        }
    },

    isSolved(puzzle, state) {
        const all = this.molecule(state, puzzle.player);
        return all.size === state.atoms.length
            && state.atoms.every((_, i) => this.freeElectrons(state, i) === 0);
    }
};
