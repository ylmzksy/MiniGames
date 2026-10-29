/**
 * Mosaic rules. Each clue is the number of black cells in the 3x3 block
 * centered on it (the clue cell itself included; blocks are cut off at the
 * edges). Fill every cell black or white so that all clues hold.
 * Levels give the solved grid ('#' black, '.' white) and which cells carry a
 * clue ('x'); the clue numbers are computed from the solution.
 */
const MosaicEngine = {
    parse(level) {
        const height = level.solution.length;
        const width = level.solution[0].length;
        const solution = level.solution.map(row => [...row].map(ch => ch === '#'));
        const clues = [];
        for (let r = 0; r < height; r++) {
            clues.push([]);
            for (let c = 0; c < width; c++) {
                clues[r][c] = level.clues[r][c] === 'x' ? this.blockCount(solution, r, c, v => v) : null;
            }
        }
        return { width, height, solution, clues };
    },

    // Cells of the 3x3 block around (r, c) that lie inside the grid
    block(grid, r, c) {
        const cells = [];
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                const nr = r + dr;
                const nc = c + dc;
                if (nr >= 0 && nc >= 0 && nr < grid.length && nc < grid[0].length) cells.push([nr, nc]);
            }
        }
        return cells;
    },

    blockCount(grid, r, c, test) {
        return this.block(grid, r, c).filter(([nr, nc]) => test(grid[nr][nc])).length;
    },

    // State of a clue for the player's grid (cells are 'black', 'white' or null):
    // 'ok' when its block is decided and matches, 'bad' when it can no longer match
    clueState(puzzle, grid, r, c) {
        const n = puzzle.clues[r][c];
        const black = this.blockCount(grid, r, c, v => v === 'black');
        const open = this.blockCount(grid, r, c, v => v === null);
        if (black > n || black + open < n) return 'bad';
        return open === 0 ? 'ok' : '';
    },

    isSolved(puzzle, grid) {
        for (let r = 0; r < puzzle.height; r++) {
            for (let c = 0; c < puzzle.width; c++) {
                if (grid[r][c] === null) return false;
                if (puzzle.clues[r][c] !== null && this.clueState(puzzle, grid, r, c) !== 'ok') return false;
            }
        }
        return true;
    }
};
