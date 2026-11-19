/**
 * Kakurasu rules. Columns weigh 1..n from left to right, rows 1..n from top to bottom.
 * A row's clue is the sum of the column weights of its shaded cells; a column's clue
 * is the sum of the row weights of its shaded cells.
 * Marks are 0 (empty), 1 (shaded) or 2 (crossed: a note that the cell stays empty).
 */
const EMPTY = 0;
const SHADED = 1;
const CROSSED = 2;

const KakurasuEngine = {
    parse(level) {
        return { size: level.rows.length, rows: [...level.rows], cols: [...level.cols] };
    },

    // The cells of row y or column x as [x, y], with the weight each one adds to that line
    line(size, axis, i) {
        return Array.from({ length: size }, (_, k) => (axis === 'row'
            ? { x: k, y: i, w: k + 1 }
            : { x: i, y: k, w: k + 1 }));
    },

    /**
     * One line's state: sum of its shaded cells, and 'ok' when it equals the clue,
     * 'bad' when it is exceeded or can no longer be reached (all non-crossed cells shaded
     * would still fall short), '' otherwise.
     */
    lineState(puzzle, marks, axis, i) {
        const clue = axis === 'row' ? puzzle.rows[i] : puzzle.cols[i];
        let sum = 0;
        let reach = 0;
        this.line(puzzle.size, axis, i).forEach(({ x, y, w }) => {
            if (marks[y][x] === SHADED) sum += w;
            if (marks[y][x] !== CROSSED) reach += w;
        });
        const state = sum === clue ? 'ok' : (sum > clue || reach < clue ? 'bad' : '');
        return { clue, sum, state };
    },

    check(puzzle, marks) {
        const n = puzzle.size;
        const rows = Array.from({ length: n }, (_, i) => this.lineState(puzzle, marks, 'row', i));
        const cols = Array.from({ length: n }, (_, i) => this.lineState(puzzle, marks, 'col', i));
        return { rows, cols };
    },

    isSolved(puzzle, marks) {
        const { rows, cols } = this.check(puzzle, marks);
        return rows.every(l => l.state === 'ok') && cols.every(l => l.state === 'ok');
    }
};
