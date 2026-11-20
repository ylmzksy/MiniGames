/**
 * Quarter Turns engine. The board is w x h cells in reading order; cells[i] holds
 * the id of the tile there (ids are start positions, labels[id] its colour/number).
 * A handle (r, c) sits on the corner shared by cells (r,c) (r,c+1) (r+1,c+1) (r+1,c)
 * and turns those four a quarter turn: dir 1 clockwise, -1 counter-clockwise.
 */
const QuarterEngine = {
    tokens(rows) {
        return rows.map(row => row.trim().split(/\s+/));
    },

    parse(level) {
        const start = this.tokens(level.start);
        const h = start.length, w = start[0].length;
        const handles = [];
        for (let r = 0; r < h - 1; r++) {
            for (let c = 0; c < w - 1; c++) {
                if (!level.handles || level.handles[r][c] === '+') handles.push({ r, c });
            }
        }
        const touched = new Set(handles.flatMap(hd => this.corners(w, hd.r, hd.c)));
        return {
            w, h, handles,
            labels: start.flat(),
            target: this.tokens(level.target).flat(),
            fixed: Array.from({ length: w * h }, (_, i) => !touched.has(i)),
            numeric: /^\d+$/.test(start[0][0]),
            par: level.par
        };
    },

    // The four cells around handle (r, c), clockwise from the top left
    corners(w, r, c) {
        const a = r * w + c;
        return [a, a + 1, a + w + 1, a + w];
    },

    // Turns the four tiles; returns [{id, from, to}] for the ones that moved
    rotate(cells, w, r, c, dir) {
        const ring = this.corners(w, r, c);
        const ids = ring.map(i => cells[i]);
        const moved = [];
        ring.forEach((from, k) => {
            const to = ring[(k + (dir > 0 ? 1 : 3)) % 4];
            cells[to] = ids[k];
            moved.push({ id: ids[k], from, to });
        });
        return moved;
    },

    isSolved(cells, labels, target) {
        return cells.every((id, i) => labels[id] === target[i]);
    }
};
