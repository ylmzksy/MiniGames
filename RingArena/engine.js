/**
 * Ring Arena rules. The arena has RINGS rings (0 = next to the hub) of SECTORS cells,
 * sectors numbered clockwise from the top. A cell holds a figure kind ('A'-'E') or null.
 *
 * Two moves:
 *   ring r, k:  every figure on ring r moves k sectors clockwise
 *   line d, k:  a line is the straight row of 2·RINGS cells through the hub, made of
 *               sector d + SECTORS/2 (outer end first) and sector d (hub first).
 *               Its figures move k cells towards the sector-d end and wrap around.
 */
const ArenaEngine = {
    RINGS: 4,
    SECTORS: 12,

    idx(r, s) {
        return r * this.SECTORS + ((s % this.SECTORS) + this.SECTORS) % this.SECTORS;
    },

    lineCount() {
        return this.SECTORS / 2;
    },

    // Cell indexes of line d, in order along the line
    linePath(d) {
        const half = this.SECTORS / 2;
        const path = [];
        for (let r = this.RINGS - 1; r >= 0; r--) path.push(this.idx(r, d + half));
        for (let r = 0; r < this.RINGS; r++) path.push(this.idx(r, d));
        return path;
    },

    // Which line a sector belongs to, and +1 if the sector is the line's sector-d end
    lineOf(s) {
        const half = this.SECTORS / 2;
        return s < half ? { d: s, side: 1 } : { d: s - half, side: -1 };
    },

    parseRows(rows) {
        return rows.join('').split('').map(ch => (ch === '.' ? null : ch));
    },

    parse(level) {
        return {
            cells: this.parseRows(level.start),
            target: level.target ? this.parseRows(level.target) : null,
            goal: level.goal,
            limit: level.moves
        };
    },

    // Period of a move kind: turning by this many steps changes nothing
    period(kind) {
        return kind === 'ring' ? this.SECTORS : 2 * this.RINGS;
    },

    // Returns the new cell array; also works on any array laid out like it (e.g. DOM elements)
    apply(cells, kind, index, steps) {
        const out = cells.slice();
        if (kind === 'ring') {
            for (let s = 0; s < this.SECTORS; s++) {
                out[this.idx(index, s + steps)] = cells[this.idx(index, s)];
            }
        } else {
            const path = this.linePath(index);
            const n = path.length;
            path.forEach((cell, i) => { out[path[(((i + steps) % n) + n) % n]] = cells[cell]; });
        }
        return out;
    },

    isSolved(state, cells) {
        switch (state.goal) {
            case 'lines': return this.allInLines(cells, false);
            case 'same': return this.allInLines(cells, true);
            case 'blocks': return this.allInBlocks(cells);
            case 'groups': return this.partition(cells);
            case 'targets': return cells.every((v, i) => v === state.target[i]);
            default: return false;
        }
    },

    // Every sector is either empty or full from the hub to the edge
    allInLines(cells, sameKind) {
        for (let s = 0; s < this.SECTORS; s++) {
            const line = [];
            for (let r = 0; r < this.RINGS; r++) line.push(cells[this.idx(r, s)]);
            const count = line.filter(Boolean).length;
            if (count !== 0 && count !== this.RINGS) return false;
            if (count && sameKind && new Set(line).size !== 1) return false;
        }
        return true;
    },

    // Every figure is part of a 2x2 square on the two inner rings
    allInBlocks(cells) {
        return cells.every((v, i) => !v || Math.floor(i / this.SECTORS) < 2) && this.partition(cells, false);
    },

    // Splits the figures into full lines and inner 2x2 squares, if possible
    partition(cells, allowLines = true) {
        const rest = new Set(cells.map((v, i) => (v ? i : -1)).filter(i => i >= 0));
        const take = (group) => group.every(i => rest.has(i));
        const go = () => {
            if (!rest.size) return true;
            const cell = Math.min(...rest);
            const r = Math.floor(cell / this.SECTORS);
            const s = cell % this.SECTORS;
            const options = [];
            if (allowLines) options.push([...Array(this.RINGS).keys()].map(rr => this.idx(rr, s)));
            if (r < 2) {
                [s - 1, s].forEach(s0 => options.push([0, 1].flatMap(rr => [this.idx(rr, s0), this.idx(rr, s0 + 1)])));
            }
            return options.some(group => {
                if (!take(group)) return false;
                group.forEach(i => rest.delete(i));
                if (go()) return true;
                group.forEach(i => rest.add(i));
                return false;
            });
        };
        return go();
    }
};
