/**
 * Sudoku. Fill the grid so every row, column and box holds each digit 1..n
 * exactly once. Boxes are boxRows x boxCols cells, and n = boxRows * boxCols.
 * Level format: `givens` rows with digits or '.', and `box: [rows, cols]`.
 */
const SudokuEngine = {
    parse(level) {
        const [boxRows, boxCols] = level.box;
        const size = boxRows * boxCols;
        const givens = level.givens.map(row => [...row].map(ch => ch === '.' ? 0 : Number(ch)));
        return { size, boxRows, boxCols, givens };
    },

    boxOf(puzzle, r, c) {
        return Math.floor(r / puzzle.boxRows) * puzzle.boxRows + Math.floor(c / puzzle.boxCols);
    },

    // Keys "r,c" of cells whose digit repeats in their row, column or box
    conflicts(puzzle, values) {
        const n = puzzle.size;
        const groups = { row: {}, col: {}, box: {} };
        for (let r = 0; r < n; r++) {
            for (let c = 0; c < n; c++) {
                const v = values[r][c];
                if (!v) continue;
                const key = `${r},${c}`;
                [['row', r], ['col', c], ['box', this.boxOf(puzzle, r, c)]].forEach(([kind, idx]) => {
                    (groups[kind][`${idx}:${v}`] ||= []).push(key);
                });
            }
        }
        const bad = new Set();
        Object.values(groups).forEach(g => Object.values(g).forEach(list => {
            if (list.length > 1) list.forEach(k => bad.add(k));
        }));
        return bad;
    },

    isSolved(puzzle, values) {
        if (values.some(row => row.some(v => !v))) return false;
        return this.conflicts(puzzle, values).size === 0;
    }
};
