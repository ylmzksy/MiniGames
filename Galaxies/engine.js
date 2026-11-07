/**
 * Galaxies (Tentai Show). Every dot is the center of one galaxy. Divide the
 * grid so each galaxy is a connected region that looks the same after a
 * half turn around its dot, and all cells belong to a galaxy.
 * Centers use doubled coordinates [y, x]: cell (r, c) is [2r+1, 2c+1]; an
 * even coordinate puts the dot on an edge or a corner between cells.
 * The player's state is owner[r][c]: galaxy index or null. Cells are always
 * assigned in mirror pairs, so every galaxy stays symmetric by construction.
 */
const GalaxiesEngine = {
    parse(level) {
        const centers = level.centers.map(([y, x]) => [y, x]);
        const centerCells = centers.map(([y, x]) => {
            const rs = y % 2 ? [(y - 1) / 2] : [y / 2 - 1, y / 2];
            const cs = x % 2 ? [(x - 1) / 2] : [x / 2 - 1, x / 2];
            return rs.flatMap(r => cs.map(c => [r, c]));
        });
        return { width: level.width, height: level.height, centers, centerCells };
    },

    create(puzzle) {
        const owner = Array.from({ length: puzzle.height }, () => Array(puzzle.width).fill(null));
        const fixed = new Set();
        puzzle.centerCells.forEach((cells, g) => cells.forEach(([r, c]) => { owner[r][c] = g; fixed.add(`${r},${c}`); }));
        return { owner, fixed };
    },

    inside(puzzle, r, c) {
        return r >= 0 && c >= 0 && r < puzzle.height && c < puzzle.width;
    },

    mirror(puzzle, g, [r, c]) {
        const [y, x] = puzzle.centers[g];
        return [y - r - 1, x - c - 1];
    },

    // Removes a cell and its mirror from whatever galaxy holds it (fixed center cells stay)
    clear(puzzle, state, r, c) {
        const g = state.owner[r][c];
        if (g === null || state.fixed.has(`${r},${c}`)) return;
        const [mr, mc] = this.mirror(puzzle, g, [r, c]);
        state.owner[r][c] = null;
        if (this.inside(puzzle, mr, mc) && !state.fixed.has(`${mr},${mc}`)) state.owner[mr][mc] = null;
    },

    // Gives (r, c) and its mirror to galaxy g; false when the mirror falls outside or a center is in the way
    assign(puzzle, state, g, r, c) {
        if (state.fixed.has(`${r},${c}`)) return state.owner[r][c] === g;
        const [mr, mc] = this.mirror(puzzle, g, [r, c]);
        if (!this.inside(puzzle, mr, mc)) return false;
        if (state.fixed.has(`${mr},${mc}`) && state.owner[mr][mc] !== g) return false;
        this.clear(puzzle, state, r, c);
        this.clear(puzzle, state, mr, mc);
        state.owner[r][c] = g;
        state.owner[mr][mc] = g;
        return true;
    },

    cellsOf(state, g) {
        const out = [];
        state.owner.forEach((row, r) => row.forEach((o, c) => { if (o === g) out.push([r, c]); }));
        return out;
    },

    isConnected(cells) {
        if (!cells.length) return true;
        const set = new Set(cells.map(([r, c]) => `${r},${c}`));
        const seen = new Set([`${cells[0][0]},${cells[0][1]}`]);
        const queue = [cells[0]];
        while (queue.length) {
            const [r, c] = queue.pop();
            [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]].forEach(([nr, nc]) => {
                const key = `${nr},${nc}`;
                if (set.has(key) && !seen.has(key)) { seen.add(key); queue.push([nr, nc]); }
            });
        }
        return seen.size === cells.length;
    },

    galaxyState(puzzle, state, g) {
        return this.isConnected(this.cellsOf(state, g)) ? '' : 'bad';
    },

    assignedCount(state) {
        return state.owner.flat().filter(o => o !== null).length;
    },

    isSolved(puzzle, state) {
        if (this.assignedCount(state) !== puzzle.width * puzzle.height) return false;
        return puzzle.centers.every((_, g) => this.isConnected(this.cellsOf(state, g)));
    }
};
