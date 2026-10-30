/**
 * Hashiwokakero (Bridges). Numbered islands sit on a grid. Connect them with
 * straight horizontal or vertical bridges so that:
 *   1. every island has exactly as many bridges as its number
 *   2. at most two bridges run between the same pair of islands
 *   3. bridges never cross each other or pass over islands
 *   4. all islands end up connected into one group
 * Level map: digits 1-8 for islands, '.' for water.
 * Bridges are stored as a Map from pair key "a-b" (island indices) to 1 or 2.
 */
const HashiEngine = {
    parse(level) {
        const islands = [];
        level.map.forEach((row, r) => [...row].forEach((ch, c) => {
            if (/[1-8]/.test(ch)) islands.push({ r, c, n: Number(ch) });
        }));
        const puzzle = { width: level.map[0].length, height: level.map.length, islands, pairs: [] };
        // Pairs of islands that see each other along a row or column
        islands.forEach((a, i) => islands.forEach((b, j) => {
            if (j <= i) return;
            if (a.r !== b.r && a.c !== b.c) return;
            const between = islands.some(x => x !== a && x !== b && (
                (a.r === b.r && x.r === a.r && x.c > Math.min(a.c, b.c) && x.c < Math.max(a.c, b.c)) ||
                (a.c === b.c && x.c === a.c && x.r > Math.min(a.r, b.r) && x.r < Math.max(a.r, b.r))));
            if (!between) puzzle.pairs.push({ a: i, b: j, key: `${i}-${j}` });
        }));
        return puzzle;
    },

    pairKey(i, j) {
        return i < j ? `${i}-${j}` : `${j}-${i}`;
    },

    pairOf(puzzle, i, j) {
        return puzzle.pairs.find(p => p.key === this.pairKey(i, j)) || null;
    },

    // Whether two pairs would cross (one horizontal, one vertical)
    crosses(puzzle, p, q) {
        const [a, b] = [puzzle.islands[p.a], puzzle.islands[p.b]];
        const [c, d] = [puzzle.islands[q.a], puzzle.islands[q.b]];
        const pHoriz = a.r === b.r;
        const qHoriz = c.r === d.r;
        if (pHoriz === qHoriz) return false;
        const [h1, h2, v1, v2] = pHoriz ? [a, b, c, d] : [c, d, a, b];
        return v1.c > Math.min(h1.c, h2.c) && v1.c < Math.max(h1.c, h2.c)
            && h1.r > Math.min(v1.r, v2.r) && h1.r < Math.max(v1.r, v2.r);
    },

    // True when a bridge on `pair` would cross an existing bridge
    blocked(puzzle, bridges, pair) {
        return puzzle.pairs.some(q => q !== pair && bridges.get(q.key) && this.crosses(puzzle, pair, q));
    },

    count(puzzle, bridges, i) {
        return puzzle.pairs.reduce((sum, p) => (p.a === i || p.b === i) ? sum + (bridges.get(p.key) || 0) : sum, 0);
    },

    islandState(puzzle, bridges, i) {
        const have = this.count(puzzle, bridges, i);
        const need = puzzle.islands[i].n;
        if (have > need) return 'bad';
        return have === need ? 'ok' : '';
    },

    isConnected(puzzle, bridges) {
        if (!puzzle.islands.length) return false;
        const seen = new Set([0]);
        const queue = [0];
        while (queue.length) {
            const i = queue.pop();
            puzzle.pairs.forEach(p => {
                if (!bridges.get(p.key)) return;
                const j = p.a === i ? p.b : p.b === i ? p.a : null;
                if (j !== null && !seen.has(j)) { seen.add(j); queue.push(j); }
            });
        }
        return seen.size === puzzle.islands.length;
    },

    isSolved(puzzle, bridges) {
        return puzzle.islands.every((_, i) => this.islandState(puzzle, bridges, i) === 'ok')
            && this.isConnected(puzzle, bridges);
    }
};
