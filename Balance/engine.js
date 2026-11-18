/**
 * Balance rules. Fill every cell with a circle (0) or a square (1):
 * - no three of the same symbol next to each other in a row or column
 * - every row and column holds as many circles as squares
 * - '=' between two cells: same symbol; 'x': different symbols.
 * Values are null (empty), 0 or 1.
 */
const BalanceEngine = {
    parse(level) {
        const size = level.grid.length;
        const givens = level.grid.map(row => [...row].map(ch => (ch === 'A' ? 0 : ch === 'B' ? 1 : null)));
        const signs = level.signs.map(([x, y, side, kind]) => ({
            a: [x, y],
            b: side === 'right' ? [x + 1, y] : [x, y + 1],
            side,
            kind
        }));
        return { size, givens, signs };
    },

    // Every row and column as a list of [x, y] cells
    lines(size) {
        const out = [];
        for (let i = 0; i < size; i++) {
            out.push(Array.from({ length: size }, (_, k) => [k, i]));
            out.push(Array.from({ length: size }, (_, k) => [i, k]));
        }
        return out;
    },

    /**
     * Finds broken rules: cells in a run of three, cells in a line with too
     * many of their symbol, and signs whose two cells disagree with them.
     * Returns { badCells: Set of "x,y", badSigns: Set of sign indexes, full }.
     */
    check(puzzle, values) {
        const size = puzzle.size;
        const badCells = new Set();
        const at = ([x, y]) => values[y][x];
        this.lines(size).forEach(line => {
            for (let i = 0; i + 2 < size; i++) {
                const v = at(line[i]);
                if (v !== null && v === at(line[i + 1]) && v === at(line[i + 2])) {
                    [line[i], line[i + 1], line[i + 2]].forEach(([x, y]) => badCells.add(`${x},${y}`));
                }
            }
            [0, 1].forEach(v => {
                const cells = line.filter(c => at(c) === v);
                if (cells.length > size / 2) cells.forEach(([x, y]) => badCells.add(`${x},${y}`));
            });
        });
        const badSigns = new Set();
        puzzle.signs.forEach((sign, i) => {
            const va = at(sign.a);
            const vb = at(sign.b);
            if (va === null || vb === null) return;
            if ((va === vb) !== (sign.kind === '=')) badSigns.add(i);
        });
        const full = values.every(row => row.every(v => v !== null));
        return { badCells, badSigns, full };
    },

    isSolved(puzzle, values) {
        const { badCells, badSigns, full } = this.check(puzzle, values);
        return full && !badCells.size && !badSigns.size;
    }
};
