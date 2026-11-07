/**
 * Laser Maze. A laser leaves the source and travels in straight lines; mirrors
 * turn it by 90°, walls stop it, the target must be lit and bombs must not be
 * hit. Tap a mirror to flip it between '/' and '\'. Some mirrors are fixed.
 * Map: 'S' source (beam leaves to the right), 'T' target, '#' wall, 'B' bomb,
 *      '/' and '\' mirrors, '.' empty.
 */
const LaserEngine = {
    parse(level) {
        const cells = level.map.map(row => [...row]);
        const n = cells.length;
        let source = null;
        cells.forEach((row, r) => row.forEach((ch, c) => { if (ch === 'S') source = [r, c]; }));
        const fixed = new Set((level.fixed || []).map(([r, c]) => `${r},${c}`));
        return { size: n, cells, source, fixed };
    },

    isMirror(ch) {
        return ch === '/' || ch === '\\';
    },

    canRotate(puzzle, r, c) {
        return this.isMirror(puzzle.cells[r][c]) && !puzzle.fixed.has(`${r},${c}`);
    },

    rotate(puzzle, r, c) {
        if (!this.canRotate(puzzle, r, c)) return false;
        puzzle.cells[r][c] = puzzle.cells[r][c] === '/' ? '\\' : '/';
        return true;
    },

    // Follows the beam: returns how it ended and the cells it crossed with in/out directions
    trace(puzzle) {
        const n = puzzle.size;
        let [r, c] = puzzle.source;
        let d = [0, 1];
        const seen = new Set();
        const path = [{ r, c, out: d }];
        for (;;) {
            r += d[0];
            c += d[1];
            if (r < 0 || c < 0 || r >= n || c >= n) return { result: 'out', path };
            const key = `${r},${c},${d}`;
            if (seen.has(key)) return { result: 'loop', path };
            seen.add(key);
            const ch = puzzle.cells[r][c];
            const entry = { r, c, in: d, out: null };
            path.push(entry);
            if (ch === '#' || ch === 'S') return { result: 'wall', path };
            if (ch === 'B') return { result: 'bomb', path, bomb: [r, c] };
            if (ch === 'T') return { result: 'target', path };
            if (ch === '/') d = [-d[1], -d[0]];
            else if (ch === '\\') d = [d[1], d[0]];
            entry.out = d;
        }
    }
};
