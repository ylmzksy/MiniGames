/**
 * Numberlink (Flow). Each letter appears twice on the grid. Draw a path between
 * every matching pair so that paths never cross or share cells and every cell
 * is covered. Level map: letters for endpoints, '.' for empty cells.
 * Player state: a Map from letter to the ordered list of cells of its path,
 * starting at one endpoint.
 */
const NumberlinkEngine = {
    parse(level) {
        const ends = new Map();
        level.map.forEach((row, r) => [...row].forEach((ch, c) => {
            if (ch !== '.') (ends.get(ch) || ends.set(ch, []).get(ch)).push([r, c]);
        }));
        return { width: level.map[0].length, height: level.map.length, ends, symbols: [...ends.keys()] };
    },

    isEndpoint(puzzle, sym, r, c) {
        return puzzle.ends.get(sym).some(([er, ec]) => er === r && ec === c);
    },

    endpointSymbol(puzzle, r, c) {
        return puzzle.symbols.find(sym => this.isEndpoint(puzzle, sym, r, c)) ?? null;
    },

    // Which path covers (r, c), and where in that path it is
    owner(paths, r, c) {
        for (const [sym, path] of paths) {
            const index = path.findIndex(([pr, pc]) => pr === r && pc === c);
            if (index >= 0) return { sym, index };
        }
        return null;
    },

    isComplete(puzzle, paths, sym) {
        const path = paths.get(sym) || [];
        if (path.length < 2) return false;
        const first = path[0];
        const last = path[path.length - 1];
        return this.isEndpoint(puzzle, sym, ...first) && this.isEndpoint(puzzle, sym, ...last)
            && (first[0] !== last[0] || first[1] !== last[1]);
    },

    covered(paths) {
        let n = 0;
        paths.forEach(path => { n += path.length; });
        return n;
    },

    isSolved(puzzle, paths) {
        return puzzle.symbols.every(sym => this.isComplete(puzzle, paths, sym))
            && this.covered(paths) === puzzle.width * puzzle.height;
    }
};
