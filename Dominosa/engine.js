/**
 * Dominosa. The grid shows the numbers of a full set of dominoes 0..n laid
 * out face up; every unordered pair appears exactly once. Split the grid into
 * dominoes (two orthogonally adjacent cells) so that each pair is used once.
 * Player state: a list of dominoes, each { a: [r, c], b: [r, c] }.
 */
const DominosaEngine = {
    parse(level) {
        const numbers = level.numbers.map(row => row.trim().split(/\s+/).map(Number));
        const max = Math.max(...numbers.flat());
        const pairs = [];
        for (let x = 0; x <= max; x++) for (let y = x; y <= max; y++) pairs.push([x, y]);
        return { width: numbers[0].length, height: numbers.length, numbers, max, pairs };
    },

    pairKey(x, y) {
        return x < y ? `${x}-${y}` : `${y}-${x}`;
    },

    keyOf(puzzle, d) {
        return this.pairKey(puzzle.numbers[d.a[0]][d.a[1]], puzzle.numbers[d.b[0]][d.b[1]]);
    },

    // Map from cell key to the index of the domino covering it
    coverage(dominoes) {
        const map = new Map();
        dominoes.forEach((d, i) => { map.set(d.a.join(','), i); map.set(d.b.join(','), i); });
        return map;
    },

    // How often each pair is used
    usage(puzzle, dominoes) {
        const used = {};
        dominoes.forEach(d => { const k = this.keyOf(puzzle, d); used[k] = (used[k] || 0) + 1; });
        return used;
    },

    canPlace(puzzle, dominoes, a, b) {
        if (Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) !== 1) return false;
        if (a[0] < 0 || b[0] < 0 || a[0] >= puzzle.height || b[0] >= puzzle.height || a[1] < 0 || b[1] < 0 || a[1] >= puzzle.width || b[1] >= puzzle.width) return false;
        const cov = this.coverage(dominoes);
        return !cov.has(a.join(',')) && !cov.has(b.join(','));
    },

    isSolved(puzzle, dominoes) {
        if (dominoes.length * 2 !== puzzle.width * puzzle.height) return false;
        return Object.values(this.usage(puzzle, dominoes)).every(n => n === 1);
    }
};
