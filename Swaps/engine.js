/**
 * Swaps rules. The board is a cols x rows grid; cells are numbered in reading
 * order and `cells[i]` is the tile (1..n) lying in cell i. A move swaps the
 * tiles of two cells, if the level's rule allows that pair of cells:
 *   any    - any two cells
 *   line   - two cells in the same row or column
 *   near   - orthogonal neighbours
 *   knight - a chess knight's move apart
 * The level is solved when every cell holds its goal tile.
 */
const SwapsEngine = {
    parse(level) {
        return {
            cols: level.cols,
            rows: level.rows,
            n: level.cols * level.rows,
            rule: level.rule || 'any',
            face: level.face || 'number',
            picture: level.picture || null,
            par: level.par,
            goal: [...level.goal],
            cells: [...level.start],
            moves: 0
        };
    },

    xy(state, i) {
        return [i % state.cols, Math.floor(i / state.cols)];
    },

    canSwap(state, a, b) {
        if (a === b || a < 0 || b < 0 || a >= state.n || b >= state.n) return false;
        const [ax, ay] = this.xy(state, a);
        const [bx, by] = this.xy(state, b);
        const dx = Math.abs(ax - bx);
        const dy = Math.abs(ay - by);
        switch (state.rule) {
            case 'line': return dx === 0 || dy === 0;
            case 'near': return dx + dy === 1;
            case 'knight': return (dx === 1 && dy === 2) || (dx === 2 && dy === 1);
            default: return true;
        }
    },

    // Swaps the tiles of cells a and b; `undo` takes a move back instead of adding one
    swap(state, a, b, undo = false) {
        [state.cells[a], state.cells[b]] = [state.cells[b], state.cells[a]];
        state.moves += undo ? -1 : 1;
    },

    cellOf(state, tile) {
        return state.cells.indexOf(tile);
    },

    isHome(state, i) {
        return state.cells[i] === state.goal[i];
    },

    homeCount(state) {
        return state.cells.filter((t, i) => t === state.goal[i]).length;
    },

    isSolved(state) {
        return this.homeCount(state) === state.n;
    }
};
