/**
 * Killer Sudoku Logic Engine
 *
 * A level stores its solved grid and a cage map (one letter per cage); the cage
 * sums are computed from the solution, so clues and answers can never disagree.
 * Rows, columns and boxes hold every digit 1..size once; digits never repeat in a cage.
 */
const KillerEngine = {
    // Box shape per grid size: [rows, cols]
    boxShapes: { 4: [2, 2], 6: [2, 3], 9: [3, 3] },

    parse(level) {
        const size = level.solution.length;
        const [boxRows, boxCols] = this.boxShapes[size];
        const solution = level.solution.map(row => [...row].map(Number));
        const index = new Map();
        const cages = [];
        const cageOf = level.cages.map((row, r) => [...row].map((ch, c) => {
            if (!index.has(ch)) {
                index.set(ch, cages.length);
                cages.push({ cells: [], sum: 0 });
            }
            const i = index.get(ch);
            cages[i].cells.push([r, c]);
            cages[i].sum += solution[r][c];
            return i;
        }));
        // The sum is written in the cage's top-left cell (first in reading order)
        cages.forEach(cage => { cage.label = cage.cells[0]; });
        return { size, boxRows, boxCols, solution, cages, cageOf };
    },

    boxOf(puzzle, r, c) {
        return Math.floor(r / puzzle.boxRows) * (puzzle.size / puzzle.boxCols) + Math.floor(c / puzzle.boxCols);
    },

    // Cells that share a row, column, box or cage with (r, c)
    peers(puzzle, r, c) {
        const result = [];
        const box = this.boxOf(puzzle, r, c);
        const cage = puzzle.cageOf[r][c];
        for (let rr = 0; rr < puzzle.size; rr++) {
            for (let cc = 0; cc < puzzle.size; cc++) {
                if (rr === r && cc === c) continue;
                if (rr === r || cc === c || this.boxOf(puzzle, rr, cc) === box || puzzle.cageOf[rr][cc] === cage) {
                    result.push([rr, cc]);
                }
            }
        }
        return result;
    },

    /**
     * cells: Set of "r,c" keys that repeat a digit in a row, column, box or cage,
     * or lie in a cage whose sum is exceeded (or wrong once full).
     * cageState[i]: 'bad', 'ok' (full and right) or '' (still open).
     */
    check(puzzle, values) {
        const n = puzzle.size;
        const cells = new Set();
        const markDuplicates = (group) => {
            const seen = new Map();
            group.forEach(([r, c]) => {
                const v = values[r][c];
                if (!v) return;
                if (seen.has(v)) {
                    cells.add(`${r},${c}`);
                    cells.add(seen.get(v));
                } else {
                    seen.set(v, `${r},${c}`);
                }
            });
        };
        for (let i = 0; i < n; i++) {
            markDuplicates(Array.from({ length: n }, (_, k) => [i, k]));
            markDuplicates(Array.from({ length: n }, (_, k) => [k, i]));
            const r0 = Math.floor(i / (n / puzzle.boxCols)) * puzzle.boxRows;
            const c0 = (i % (n / puzzle.boxCols)) * puzzle.boxCols;
            markDuplicates(Array.from({ length: n }, (_, k) =>
                [r0 + Math.floor(k / puzzle.boxCols), c0 + (k % puzzle.boxCols)]));
        }
        const cageState = puzzle.cages.map(cage => {
            markDuplicates(cage.cells);
            const digits = cage.cells.map(([r, c]) => values[r][c]);
            const total = digits.reduce((a, b) => a + b, 0);
            const full = digits.every(Boolean);
            if (total > cage.sum || (full && total !== cage.sum)) {
                cage.cells.forEach(([r, c]) => cells.add(`${r},${c}`));
                return 'bad';
            }
            return full ? 'ok' : '';
        });
        return { cells, cageState };
    },

    isSolved(puzzle, values) {
        const allFilled = values.every(row => row.every(v => v > 0));
        return allFilled && this.check(puzzle, values).cells.size === 0;
    },

    /**
     * Counts solutions (up to `limit`) from the cage sums alone, ignoring the stored
     * solution: a backtracking search that always fills the cell with fewest options.
     */
    countSolutions(puzzle, limit = 2) {
        const n = puzzle.size;
        const all = ((1 << n) - 1) << 1;
        const rowUsed = new Array(n).fill(0);
        const colUsed = new Array(n).fill(0);
        const boxUsed = new Array(n).fill(0);
        const cages = puzzle.cages.map(cage => ({ used: 0, left: cage.sum, empty: cage.cells.length }));
        const cellCage = puzzle.cageOf.flat();
        const cellBox = [];
        for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) cellBox.push(this.boxOf(puzzle, r, c));
        const filled = new Array(n * n).fill(false);

        // Can `d` go into a cage that still needs `left` from `empty` cells (d included)?
        const fits = (cage, d) => {
            const rest = cage.left - d;
            const k = cage.empty - 1;
            if (rest < 0) return false;
            if (k === 0) return rest === 0;
            let lo = 0, hi = 0, cntLo = 0, cntHi = 0;
            for (let x = 1; x <= n && cntLo < k; x++) {
                if (x !== d && !(cage.used >> x & 1)) { lo += x; cntLo++; }
            }
            for (let x = n; x >= 1 && cntHi < k; x--) {
                if (x !== d && !(cage.used >> x & 1)) { hi += x; cntHi++; }
            }
            return cntLo === k && lo <= rest && rest <= hi;
        };

        let count = 0;
        const search = () => {
            let best = -1, bestMask = 0, bestCount = 99;
            for (let i = 0; i < n * n; i++) {
                if (filled[i]) continue;
                const r = Math.floor(i / n), c = i % n;
                const cage = cages[cellCage[i]];
                let mask = all & ~(rowUsed[r] | colUsed[c] | boxUsed[cellBox[i]] | cage.used);
                let cnt = 0;
                for (let d = 1; d <= n; d++) {
                    if (mask >> d & 1) {
                        if (fits(cage, d)) cnt++;
                        else mask &= ~(1 << d);
                    }
                }
                if (cnt === 0) return;
                if (cnt < bestCount) { best = i; bestMask = mask; bestCount = cnt; if (cnt === 1) break; }
            }
            if (best < 0) { count++; return; }
            const r = Math.floor(best / n), c = best % n;
            const cage = cages[cellCage[best]];
            for (let d = 1; d <= n && count < limit; d++) {
                if (!(bestMask >> d & 1)) continue;
                const bit = 1 << d;
                filled[best] = true;
                rowUsed[r] |= bit; colUsed[c] |= bit; boxUsed[cellBox[best]] |= bit; cage.used |= bit;
                cage.left -= d; cage.empty--;
                search();
                filled[best] = false;
                rowUsed[r] &= ~bit; colUsed[c] &= ~bit; boxUsed[cellBox[best]] &= ~bit; cage.used &= ~bit;
                cage.left += d; cage.empty++;
            }
        };
        search();
        return count;
    }
};
