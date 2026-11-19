/**
 * Magic Square rules. Fill an n × n grid with the numbers 1..n² so that each
 * number is used once and every row, every column and both main diagonals add
 * up to the magic sum n(n² + 1) / 2. Values are null (empty) or a number.
 */
const MagicEngine = {
    parse(level) {
        const size = level.size;
        const givens = level.grid.map(row => row.map(v => (v ? v : null)));
        const range = Array.from({ length: size }, (_, i) => i);
        const lines = [
            ...range.map(y => ({ kind: 'row', index: y, cells: range.map(x => [x, y]) })),
            ...range.map(x => ({ kind: 'col', index: x, cells: range.map(y => [x, y]) })),
            { kind: 'diag', index: 0, cells: range.map(i => [i, i]) },
            { kind: 'anti', index: 0, cells: range.map(i => [size - 1 - i, i]) }
        ];
        return { size, total: size * size, magic: size * (size * size + 1) / 2, givens, lines };
    },

    /**
     * Sums every line and finds repeated numbers. A line is 'ok' when it is full
     * and hits the magic sum, 'bad' when it is already over (or reaches the sum
     * with cells still empty), or full with the wrong sum.
     * Returns { dup: Set of "x,y", lines: [{ sum, filled, state }], full }.
     */
    check(puzzle, values) {
        const { size, magic } = puzzle;
        const seen = {};
        values.forEach((row, y) => row.forEach((v, x) => {
            if (v !== null) (seen[v] = seen[v] || []).push(`${x},${y}`);
        }));
        const dup = new Set();
        Object.values(seen).forEach(list => { if (list.length > 1) list.forEach(k => dup.add(k)); });
        const lines = puzzle.lines.map(line => {
            let sum = 0;
            let filled = 0;
            line.cells.forEach(([x, y]) => {
                if (values[y][x] !== null) { sum += values[y][x]; filled++; }
            });
            let state = '';
            if (filled === size) state = sum === magic ? 'ok' : 'bad';
            else if (sum >= magic) state = 'bad';
            return { sum, filled, state };
        });
        const full = values.every(row => row.every(v => v !== null));
        return { dup, lines, full };
    },

    isSolved(puzzle, values) {
        const { dup, lines, full } = this.check(puzzle, values);
        return full && !dup.size && lines.every(l => l.state === 'ok');
    }
};
