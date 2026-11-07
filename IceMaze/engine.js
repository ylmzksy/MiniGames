/**
 * Ice Maze. You slide across the ice until something stops you: a wall, the
 * edge of the maze, a patch of rough ground, or the exit. Gems are collected
 * as you slide over them; the exit only works once every gem is collected.
 * Map: '#' wall, '.' ice, ':' rough ground, '*' gem, 'S' start, 'X' exit.
 */
const IceEngine = {
    directions: { up: [-1, 0], down: [1, 0], left: [0, -1], right: [0, 1] },

    parse(level) {
        const cells = level.map.map(row => [...row]);
        const height = cells.length;
        const width = cells[0].length;
        let player = null;
        let gems = 0;
        cells.forEach((row, r) => row.forEach((ch, c) => {
            if (ch === 'S') { player = [r, c]; row[c] = '.'; }
            if (ch === '*') gems++;
        }));
        return { width, height, cells, player, gemsLeft: gems, moves: 0, par: level.par, exited: false };
    },

    // Slides the player; returns the cells passed (for animation) or an empty list when nothing moved
    slide(state, dir) {
        if (state.exited) return [];
        const [dr, dc] = this.directions[dir];
        let [r, c] = state.player;
        const passed = [];
        for (;;) {
            const nr = r + dr;
            const nc = c + dc;
            const ch = state.cells[nr]?.[nc];
            if (ch === undefined || ch === '#') break;
            r = nr;
            c = nc;
            passed.push([r, c]);
            if (ch === '*') { state.cells[r][c] = '.'; state.gemsLeft--; }
            if (ch === ':' || ch === 'X') break;
        }
        if (!passed.length) return [];
        state.player = [r, c];
        state.moves++;
        if (state.cells[r][c] === 'X' && state.gemsLeft === 0) state.exited = true;
        return passed;
    }
};
