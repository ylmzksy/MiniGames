/**
 * Skyscrapers. Fill the n x n grid with building heights 1..n so every row and
 * column holds each height once. A clue on the border says how many buildings
 * can be seen looking along that line from there: a taller building hides
 * every shorter one behind it.
 * Level format: `size` and clue arrays `top`, `bottom`, `left`, `right` (0 = no clue).
 */
const SkyscrapersEngine = {
    parse(level) {
        return { size: level.size, clues: { top: level.top, bottom: level.bottom, left: level.left, right: level.right } };
    },

    // Cells of a clue's line in viewing order
    line(puzzle, side, index) {
        const n = puzzle.size;
        const cells = [];
        for (let i = 0; i < n; i++) {
            if (side === 'top') cells.push([i, index]);
            else if (side === 'bottom') cells.push([n - 1 - i, index]);
            else if (side === 'left') cells.push([index, i]);
            else cells.push([index, n - 1 - i]);
        }
        return cells;
    },

    visible(heights) {
        let count = 0;
        let tallest = 0;
        heights.forEach(h => { if (h > tallest) { count++; tallest = h; } });
        return count;
    },

    // 'ok' when the line is full and shows the clue's count, 'bad' when full and wrong
    // or when the buildings seen so far already exceed the clue
    clueState(puzzle, values, side, index) {
        const clue = puzzle.clues[side][index];
        if (!clue) return '';
        const heights = this.line(puzzle, side, index).map(([r, c]) => values[r][c]);
        const full = heights.every(h => h > 0);
        if (full) return this.visible(heights) === clue ? 'ok' : 'bad';
        // partial check on the unbroken filled prefix
        const prefix = [];
        for (const h of heights) { if (!h) break; prefix.push(h); }
        if (this.visible(prefix) > clue) return 'bad';
        if (prefix.includes(puzzle.size) && this.visible(prefix) < clue) return 'bad';
        return '';
    },

    // Keys "r,c" of cells whose height repeats in their row or column
    conflicts(puzzle, values) {
        const n = puzzle.size;
        const bad = new Set();
        for (let i = 0; i < n; i++) {
            const rowSeen = {};
            const colSeen = {};
            for (let j = 0; j < n; j++) {
                if (values[i][j]) (rowSeen[values[i][j]] ||= []).push(`${i},${j}`);
                if (values[j][i]) (colSeen[values[j][i]] ||= []).push(`${j},${i}`);
            }
            [rowSeen, colSeen].forEach(seen => Object.values(seen).forEach(list => {
                if (list.length > 1) list.forEach(k => bad.add(k));
            }));
        }
        return bad;
    },

    isSolved(puzzle, values) {
        if (values.some(row => row.some(v => !v))) return false;
        if (this.conflicts(puzzle, values).size) return false;
        const n = puzzle.size;
        for (const side of ['top', 'bottom', 'left', 'right']) {
            for (let i = 0; i < n; i++) {
                if (puzzle.clues[side][i] && this.clueState(puzzle, values, side, i) !== 'ok') return false;
            }
        }
        return true;
    }
};
