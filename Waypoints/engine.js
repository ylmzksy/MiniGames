/**
 * Waypoints rules. Draw one trail through every cell of the grid, moving
 * between side-by-side cells and never crossing a wall. It starts on
 * checkpoint 1, must pass the checkpoints in order, and ends on the last one.
 * Cells are [x, y]; the trail is the list of cells from the start.
 */
const WaypointsEngine = {
    key(x, y) {
        return `${x},${y}`;
    },

    wallKey(x1, y1, x2, y2) {
        const a = this.key(x1, y1);
        const b = this.key(x2, y2);
        return a < b ? `${a}|${b}` : `${b}|${a}`;
    },

    parse(level) {
        const checkAt = new Map();
        level.checkpoints.forEach(([x, y], i) => checkAt.set(this.key(x, y), i + 1));
        const walls = new Set(level.walls.map(w => this.wallKey(...w)));
        return {
            width: level.width,
            height: level.height,
            checkpoints: level.checkpoints,
            checkAt,
            walls
        };
    },

    inside(puzzle, x, y) {
        return x >= 0 && y >= 0 && x < puzzle.width && y < puzzle.height;
    },

    // Side by side and no wall between
    canStep(puzzle, a, b) {
        const dist = Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
        return dist === 1 && this.inside(puzzle, b[0], b[1]) && !puzzle.walls.has(this.wallKey(a[0], a[1], b[0], b[1]));
    },

    // The checkpoint number the trail must reach next
    nextCheckpoint(puzzle, trail) {
        return trail.filter(([x, y]) => puzzle.checkAt.has(this.key(x, y))).length + 1;
    },

    indexOf(trail, cell) {
        return trail.findIndex(c => c[0] === cell[0] && c[1] === cell[1]);
    },

    /**
     * Tries to add `cell` to the end of the trail. Returns the reason it can't:
     * null if it was added, else 'blocked' (not next to the end or a wall),
     * 'used' (already on the trail) or 'order' (a checkpoint out of turn).
     */
    extend(puzzle, trail, cell) {
        if (!trail.length) {
            if (puzzle.checkAt.get(this.key(...cell)) !== 1) return 'order';
            trail.push(cell);
            return null;
        }
        const head = trail[trail.length - 1];
        if (!this.canStep(puzzle, head, cell)) return 'blocked';
        if (this.indexOf(trail, cell) >= 0) return 'used';
        const number = puzzle.checkAt.get(this.key(...cell));
        if (number !== undefined && number !== this.nextCheckpoint(puzzle, trail)) return 'order';
        trail.push(cell);
        return null;
    },

    isSolved(puzzle, trail) {
        const last = puzzle.checkpoints[puzzle.checkpoints.length - 1];
        const end = trail[trail.length - 1];
        return trail.length === puzzle.width * puzzle.height &&
            end[0] === last[0] && end[1] === last[1] &&
            this.nextCheckpoint(puzzle, trail) === puzzle.checkpoints.length + 1;
    }
};
