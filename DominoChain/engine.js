/**
 * Domino Chain: a solo puzzle. The line starts with one tile; every tile in
 * your tray must be added to it, matching halves as in Dominoes. In a ring
 * level the two open ends must also show the same number at the finish, so
 * the chain could close into a loop.
 * Level: { name, start: [a, b], tiles: [[a, b], ...], ring }
 */
const ChainEngine = {
    create(level) {
        const line = Dominoes.place(Dominoes.emptyLine(), level.start, 'right', level.start[1]);
        return { line, tray: level.tiles.map(t => [...t]), ring: !!level.ring };
    },

    // Ways to add tray tile `idx`: [{ end, outer }]
    placements(state, idx) {
        const tile = state.tray[idx];
        const ends = Dominoes.ends(state.line);
        const out = [];
        ['left', 'right'].forEach(end => {
            const outers = new Set();
            if (tile[0] === ends[end]) outers.add(tile[1]);
            if (tile[1] === ends[end]) outers.add(tile[0]);
            outers.forEach(outer => out.push({ end, outer }));
        });
        // With a lone double on the line both ends are the same place
        if (state.line.tiles.length === 1 && ends.left === ends.right) return out.filter(p => p.end === 'right');
        return out;
    },

    play(state, idx, move) {
        const line = Dominoes.place(state.line, state.tray[idx], move.end, move.outer);
        line.lastIdx = move.end === 'left' ? 0 : line.tiles.length - 1;
        return { ...state, line, tray: state.tray.filter((_, i) => i !== idx) };
    },

    isSolved(state) {
        if (state.tray.length) return false;
        const ends = Dominoes.ends(state.line);
        return !state.ring || ends.left === ends.right;
    },

    isStuck(state) {
        if (!state.tray.length) return !this.isSolved(state);
        return state.tray.every((_, idx) => !this.placements(state, idx).length);
    }
};
