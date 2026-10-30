/**
 * Hitori rules. Shade cells of a number grid so that:
 *   1. no number appears more than once among the unshaded cells of a row or column
 *   2. shaded cells never touch orthogonally
 *   3. all unshaded cells form one orthogonally connected area
 * Player marks: 'shaded', 'white' (a helper mark meaning "surely unshaded") or null.
 * Unmarked cells count as unshaded when the rules are checked.
 */
const HitoriEngine = {
    parse(level) {
        const numbers = level.numbers.map(row => row.trim().split(/\s+/).map(Number));
        return { size: numbers.length, numbers };
    },

    // Keys "r,c" of cells that break a rule: repeated unshaded numbers and touching shaded cells
    conflicts(puzzle, marks) {
        const bad = new Set();
        const n = puzzle.size;
        for (let i = 0; i < n; i++) {
            const rowSeen = {};
            const colSeen = {};
            for (let j = 0; j < n; j++) {
                if (marks[i][j] !== 'shaded') (rowSeen[puzzle.numbers[i][j]] ||= []).push(`${i},${j}`);
                if (marks[j][i] !== 'shaded') (colSeen[puzzle.numbers[j][i]] ||= []).push(`${j},${i}`);
            }
            [rowSeen, colSeen].forEach(seen => Object.values(seen).forEach(list => {
                if (list.length > 1) list.forEach(key => bad.add(key));
            }));
        }
        for (let r = 0; r < n; r++) {
            for (let c = 0; c < n; c++) {
                if (marks[r][c] !== 'shaded') continue;
                if ((c + 1 < n && marks[r][c + 1] === 'shaded') || (r + 1 < n && marks[r + 1][c] === 'shaded')) {
                    bad.add(`${r},${c}`);
                    if (c + 1 < n && marks[r][c + 1] === 'shaded') bad.add(`${r},${c + 1}`);
                    if (r + 1 < n && marks[r + 1][c] === 'shaded') bad.add(`${r + 1},${c}`);
                }
            }
        }
        return bad;
    },

    // True when every unshaded cell can reach every other without crossing shaded cells
    isConnected(puzzle, marks) {
        const n = puzzle.size;
        let start = null;
        let total = 0;
        for (let r = 0; r < n; r++) {
            for (let c = 0; c < n; c++) {
                if (marks[r][c] !== 'shaded') { total++; if (!start) start = [r, c]; }
            }
        }
        if (!start) return false;
        const seen = new Set([`${start[0]},${start[1]}`]);
        const queue = [start];
        while (queue.length) {
            const [r, c] = queue.shift();
            [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]].forEach(([nr, nc]) => {
                if (nr < 0 || nc < 0 || nr >= n || nc >= n || marks[nr][nc] === 'shaded') return;
                const key = `${nr},${nc}`;
                if (!seen.has(key)) { seen.add(key); queue.push([nr, nc]); }
            });
        }
        return seen.size === total;
    },

    isSolved(puzzle, marks) {
        return this.conflicts(puzzle, marks).size === 0 && this.isConnected(puzzle, marks);
    }
};
