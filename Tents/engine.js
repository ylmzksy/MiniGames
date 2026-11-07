/**
 * Tents. Every tree needs its own tent on a cell orthogonally next to it.
 * Tents never touch each other, not even diagonally, and the numbers along
 * the edges say how many tents each row and column holds.
 * Level: `trees` rows with 'T' and '.', `rows` and `cols` tent counts.
 * Player marks: 'tent', 'grass' (a note meaning "no tent") or null.
 */
const TentsEngine = {
    directions: [[-1, 0], [1, 0], [0, -1], [0, 1]],

    parse(level) {
        const trees = level.trees.map(row => [...row].map(ch => ch === 'T'));
        return { width: trees[0].length, height: trees.length, trees, rows: level.rows, cols: level.cols };
    },

    tents(marks) {
        const out = [];
        marks.forEach((row, r) => row.forEach((m, c) => { if (m === 'tent') out.push([r, c]); }));
        return out;
    },

    rowCount(marks, r) {
        return marks[r].filter(m => m === 'tent').length;
    },

    colCount(marks, c) {
        return marks.filter(row => row[c] === 'tent').length;
    },

    // Keys "r,c" of tents that touch another tent (including diagonally)
    touching(marks) {
        const bad = new Set();
        const tents = this.tents(marks);
        tents.forEach(a => tents.forEach(b => {
            if (a !== b && Math.abs(a[0] - b[0]) <= 1 && Math.abs(a[1] - b[1]) <= 1) bad.add(`${a[0]},${a[1]}`);
        }));
        return bad;
    },

    // True when every tree can be paired with its own adjacent tent (bipartite matching)
    hasPairing(puzzle, marks) {
        const trees = [];
        puzzle.trees.forEach((row, r) => row.forEach((t, c) => { if (t) trees.push([r, c]); }));
        const tents = this.tents(marks);
        if (tents.length !== trees.length) return false;
        const tentIndex = new Map(tents.map((t, i) => [`${t[0]},${t[1]}`, i]));
        const adj = trees.map(([r, c]) => this.directions
            .map(([dr, dc]) => tentIndex.get(`${r + dr},${c + dc}`))
            .filter(i => i !== undefined));
        const matchTent = Array(tents.length).fill(-1);
        const tryTree = (i, seen) => {
            for (const j of adj[i]) {
                if (seen.has(j)) continue;
                seen.add(j);
                if (matchTent[j] < 0 || tryTree(matchTent[j], seen)) { matchTent[j] = i; return true; }
            }
            return false;
        };
        return trees.every((_, i) => tryTree(i, new Set()));
    },

    isSolved(puzzle, marks) {
        for (let r = 0; r < puzzle.height; r++) if (this.rowCount(marks, r) !== puzzle.rows[r]) return false;
        for (let c = 0; c < puzzle.width; c++) if (this.colCount(marks, c) !== puzzle.cols[c]) return false;
        return this.touching(marks).size === 0 && this.hasPairing(puzzle, marks);
    }
};
