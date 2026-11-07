/**
 * KenKen (Calcudoku). Fill the n x n grid so every row and column holds
 * 1..n once. The grid is split into cages; the numbers in a cage must make
 * the cage's target with its operation (+ − × ÷). A number may repeat inside
 * a cage only in different rows and columns. Level: size, cages [{cells, target, op}].
 */
const KenKenEngine = {
    parse(level) {
        const n = level.size;
        const cageOf = Array.from({ length: n }, () => Array(n).fill(null));
        level.cages.forEach((cage, i) => cage.cells.forEach(([r, c]) => { cageOf[r][c] = i; }));
        // the cage label goes in its top-left-most cell (first in reading order)
        const labelCell = level.cages.map(cage => [...cage.cells].sort((a, b) => a[0] - b[0] || a[1] - b[1])[0]);
        return { size: n, cages: level.cages, cageOf, labelCell };
    },

    opSymbol(op) {
        return { '+': '+', '-': '−', '*': '×', '/': '÷', '': '' }[op] ?? op;
    },

    cageHolds(cage, values) {
        const vals = cage.cells.map(([r, c]) => values[r][c]);
        if (vals.some(v => !v)) return null; // not full yet
        switch (cage.op) {
            case '': return vals[0] === cage.target;
            case '+': return vals.reduce((a, b) => a + b, 0) === cage.target;
            case '*': return vals.reduce((a, b) => a * b, 1) === cage.target;
            case '-': return vals.length === 2 && Math.abs(vals[0] - vals[1]) === cage.target;
            case '/': return vals.length === 2 && (vals[0] * cage.target === vals[1] || vals[1] * cage.target === vals[0]);
            default: return false;
        }
    },

    // 'ok' when full and right, 'bad' when full and wrong or a sum/product already too big
    cageState(cage, values) {
        const holds = this.cageHolds(cage, values);
        if (holds !== null) return holds ? 'ok' : 'bad';
        const vals = cage.cells.map(([r, c]) => values[r][c]).filter(Boolean);
        if (cage.op === '+' && vals.reduce((a, b) => a + b, 0) >= cage.target) return 'bad';
        if (cage.op === '*' && vals.reduce((a, b) => a * b, 1) > cage.target) return 'bad';
        return '';
    },

    // Keys "r,c" of cells repeating a number in their row or column
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
            [rowSeen, colSeen].forEach(seen => Object.values(seen).forEach(list => { if (list.length > 1) list.forEach(k => bad.add(k)); }));
        }
        return bad;
    },

    isSolved(puzzle, values) {
        if (values.some(row => row.some(v => !v))) return false;
        if (this.conflicts(puzzle, values).size) return false;
        return puzzle.cages.every(cage => this.cageHolds(cage, values) === true);
    }
};
