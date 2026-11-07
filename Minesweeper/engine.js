/**
 * Minesweeper. Every level is a fixed board with a fixed opening cell that is
 * revealed at the start, chosen so the whole board can be cleared by
 * deduction alone. Board rows: '*' mine, '.' safe.
 * Cell states: 'hidden', 'revealed' or 'flag'.
 */
const MinesweeperEngine = {
    parse(level) {
        const mines = level.board.map(row => [...row].map(ch => ch === '*'));
        const height = mines.length;
        const width = mines[0].length;
        const numbers = mines.map((row, r) => row.map((_, c) => this.neighbors(width, height, r, c).filter(([nr, nc]) => mines[nr][nc]).length));
        const state = { width, height, mines, numbers, cells: mines.map(row => row.map(() => 'hidden')), exploded: null, total: mines.flat().filter(Boolean).length };
        this.reveal(state, level.start[0], level.start[1]);
        return state;
    },

    neighbors(width, height, r, c) {
        const out = [];
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (!dr && !dc) continue;
                const nr = r + dr;
                const nc = c + dc;
                if (nr >= 0 && nc >= 0 && nr < height && nc < width) out.push([nr, nc]);
            }
        }
        return out;
    },

    // Reveals a cell; zeros flood outward. Returns false when a mine was hit
    reveal(state, r, c) {
        if (state.cells[r][c] !== 'hidden') return true;
        if (state.mines[r][c]) { state.exploded = [r, c]; state.cells[r][c] = 'revealed'; return false; }
        const stack = [[r, c]];
        while (stack.length) {
            const [cr, cc] = stack.pop();
            if (state.cells[cr][cc] !== 'hidden') continue;
            state.cells[cr][cc] = 'revealed';
            if (state.numbers[cr][cc] === 0) {
                this.neighbors(state.width, state.height, cr, cc).forEach(([nr, nc]) => { if (state.cells[nr][nc] === 'hidden') stack.push([nr, nc]); });
            }
        }
        return true;
    },

    toggleFlag(state, r, c) {
        if (state.cells[r][c] === 'revealed') return;
        state.cells[r][c] = state.cells[r][c] === 'flag' ? 'hidden' : 'flag';
    },

    // Reveals all unflagged neighbors of a revealed number whose flags are complete
    chord(state, r, c) {
        if (state.cells[r][c] !== 'revealed') return true;
        const around = this.neighbors(state.width, state.height, r, c);
        const flags = around.filter(([nr, nc]) => state.cells[nr][nc] === 'flag').length;
        if (flags !== state.numbers[r][c]) return true;
        for (const [nr, nc] of around) {
            if (state.cells[nr][nc] === 'hidden' && !this.reveal(state, nr, nc)) return false;
        }
        return true;
    },

    flagsPlaced(state) {
        return state.cells.flat().filter(s => s === 'flag').length;
    },

    isSolved(state) {
        if (state.exploded) return false;
        for (let r = 0; r < state.height; r++) {
            for (let c = 0; c < state.width; c++) {
                if (!state.mines[r][c] && state.cells[r][c] !== 'revealed') return false;
            }
        }
        return true;
    }
};
