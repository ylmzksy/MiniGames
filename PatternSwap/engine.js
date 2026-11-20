/**
 * Pattern Swap rules. The board is a cols x rows grid of coloured tiles; cells
 * are numbered in reading order. Every tile has an id (so its DOM element can
 * follow it) and a colour letter. A move swaps two orthogonally adjacent tiles
 * of different colours (swapping equal colours would change nothing).
 * The level is solved when every cell shows the colour of the goal pattern.
 */
const PatternEngine = {
    parse(level) {
        const goal = level.goal.join('');
        const start = level.start.join('');
        const tiles = [...start].map((c, id) => ({ id, c }));
        return {
            cols: level.goal[0].length,
            rows: level.goal.length,
            n: goal.length,
            colors: level.colors,
            par: level.par,
            goal,
            tiles,
            cells: tiles.map(t => t.id), // cells[i] = id of the tile in cell i
            moves: 0
        };
    },

    xy(state, i) {
        return [i % state.cols, Math.floor(i / state.cols)];
    },

    // The cell next to i in direction (dx, dy), or -1 at the edge
    step(state, i, dx, dy) {
        const [x, y] = this.xy(state, i);
        const nx = x + dx;
        const ny = y + dy;
        return nx >= 0 && ny >= 0 && nx < state.cols && ny < state.rows ? ny * state.cols + nx : -1;
    },

    color(state, i) {
        return state.tiles[state.cells[i]].c;
    },

    isNeighbour(state, a, b) {
        if (a < 0 || b < 0) return false;
        const [ax, ay] = this.xy(state, a);
        const [bx, by] = this.xy(state, b);
        return Math.abs(ax - bx) + Math.abs(ay - by) === 1;
    },

    canSwap(state, a, b) {
        return this.isNeighbour(state, a, b) && this.color(state, a) !== this.color(state, b);
    },

    swap(state, a, b, undo = false) {
        [state.cells[a], state.cells[b]] = [state.cells[b], state.cells[a]];
        state.moves += undo ? -1 : 1;
    },

    cellOf(state, id) {
        return state.cells.indexOf(id);
    },

    isRight(state, i) {
        return this.color(state, i) === state.goal[i];
    },

    rightCount(state) {
        let count = 0;
        for (let i = 0; i < state.n; i++) if (this.isRight(state, i)) count++;
        return count;
    },

    isSolved(state) {
        return this.rightCount(state) === state.n;
    }
};
