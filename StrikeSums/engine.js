/**
 * Strike Sums rules. Every cell holds a number; cross some out so that the numbers
 * left in each row and column add up to that line's target.
 * Marks are 0 (neutral, still counted), 1 (crossed out) or 2 (kept: a note that
 * the number stays; it counts like a neutral one).
 */
const NEUTRAL = 0;
const CROSSED = 1;
const KEPT = 2;

const StrikeEngine = {
    parse(level) {
        return {
            size: level.grid.length,
            grid: level.grid.map(row => [...row]),
            rows: [...level.rows],
            cols: [...level.cols]
        };
    },

    line(size, axis, i) {
        return Array.from({ length: size }, (_, k) => (axis === 'row' ? [k, i] : [i, k]));
    },

    /**
     * One line's state: the sum of its numbers that are not crossed out, and 'ok' when
     * it equals the target, 'bad' when the target is out of reach (crossed and kept
     * numbers already fix the sum too high or too low), '' otherwise.
     */
    lineState(puzzle, marks, axis, i) {
        const target = axis === 'row' ? puzzle.rows[i] : puzzle.cols[i];
        let sum = 0;
        let low = 0;
        let high = 0;
        this.line(puzzle.size, axis, i).forEach(([x, y]) => {
            const v = puzzle.grid[y][x];
            const m = marks[y][x];
            if (m !== CROSSED) sum += v;
            if (m === KEPT) { low += v; high += v; }
            else if (m === NEUTRAL) { low += Math.min(0, v); high += Math.max(0, v); }
        });
        const state = sum === target ? 'ok' : (target < low || target > high ? 'bad' : '');
        return { target, sum, state };
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
