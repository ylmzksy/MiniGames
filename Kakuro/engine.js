/**
 * Kakuro Logic Engine
 *
 * A level stores its solved grid; the clue sums are computed from it, so clues
 * and answers can never disagree. A "run" is a row or column block of white cells.
 */
const KakuroEngine = {
    parse(level) {
        const cells = level.solution.map(row =>
            [...row].map(ch => (ch === '#' ? { block: true } : { block: false, answer: Number(ch) })));
        const height = cells.length;
        const width = cells[0].length;
        const runs = [];

        const collect = (dir, r, c) => {
            const [dr, dc] = dir === 'across' ? [0, 1] : [1, 0];
            const run = { dir, cells: [], sum: 0 };
            while (r < height && c < width && !cells[r][c].block) {
                run.cells.push([r, c]);
                run.sum += cells[r][c].answer;
                r += dr;
                c += dc;
            }
            return run;
        };

        for (let r = 0; r < height; r++) {
            for (let c = 0; c < width; c++) {
                if (cells[r][c].block) continue;
                // A run starts right after a black cell, which then shows the clue
                if (c > 0 && cells[r][c - 1].block) {
                    const run = collect('across', r, c);
                    cells[r][c - 1].across = run.sum;
                    runs.push(run);
                }
                if (r > 0 && cells[r - 1][c].block) {
                    const run = collect('down', r, c);
                    cells[r - 1][c].down = run.sum;
                    runs.push(run);
                }
            }
        }

        // Index of the runs each white cell belongs to (across first)
        const cellRuns = new Map();
        runs.forEach((run, i) => run.cells.forEach(([r, c]) => {
            const key = `${r},${c}`;
            cellRuns.set(key, [...(cellRuns.get(key) || []), i]);
        }));
        cellRuns.forEach(list => list.sort((a, b) => (runs[a].dir === 'across' ? -1 : 1) - (runs[b].dir === 'across' ? -1 : 1)));

        return { cells, runs, cellRuns, height, width };
    },

    runsAt(puzzle, r, c) {
        return puzzle.cellRuns.get(`${r},${c}`) || [];
    },

    // Keys ("r,c") of cells that repeat a digit in a run, or belong to a full run with the wrong sum
    conflicts(puzzle, values) {
        const result = new Set();
        puzzle.runs.forEach(run => {
            const digits = run.cells.map(([r, c]) => values[r][c]);
            run.cells.forEach(([r, c], i) => {
                if (digits[i] && digits.indexOf(digits[i]) !== digits.lastIndexOf(digits[i])) {
                    result.add(`${r},${c}`);
                }
            });
            const isFull = digits.every(Boolean);
            if (isFull && digits.reduce((a, b) => a + b, 0) !== run.sum) {
                run.cells.forEach(([r, c]) => result.add(`${r},${c}`));
            }
        });
        return result;
    },

    isSolved(puzzle, values) {
        const allFilled = puzzle.cells.every((row, r) => row.every((cell, c) => cell.block || values[r][c] > 0));
        return allFilled && this.conflicts(puzzle, values).size === 0;
    },

    // All sets of `length` different digits 1-9 adding up to `sum`, e.g. (16, 2) -> [[7, 9]]
    combinations(sum, length, from = 1) {
        if (length === 0) return sum === 0 ? [[]] : [];
        const result = [];
        for (let d = from; d <= 9 && d <= sum; d++) {
            this.combinations(sum - d, length - 1, d + 1).forEach(rest => result.push([d, ...rest]));
        }
        return result;
    }
};
