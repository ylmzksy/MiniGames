/**
 * Shared domino code: the tile set, the line of play and how tiles are drawn.
 * A tile is [a, b]. The line of play keeps its tiles in order from left to
 * right, each turned so that touching halves sit next to each other, so the
 * open ends are the outer halves of the first and last tile.
 */
const Dominoes = {
    // Every tile from [0, 0] to [maxPip, maxPip], each once
    set(maxPip) {
        const tiles = [];
        for (let a = 0; a <= maxPip; a++) {
            for (let b = a; b <= maxPip; b++) tiles.push([a, b]);
        }
        return tiles;
    },

    shuffle(list, rand = Math.random) {
        const out = [...list];
        for (let i = out.length - 1; i > 0; i--) {
            const j = Math.floor(rand() * (i + 1));
            [out[i], out[j]] = [out[j], out[i]];
        }
        return out;
    },

    isDouble(t) {
        return t[0] === t[1];
    },

    pips(t) {
        return t[0] + t[1];
    },

    handPips(hand) {
        return hand.reduce((sum, t) => sum + t[0] + t[1], 0);
    },

    same(t, u) {
        return (t[0] === u[0] && t[1] === u[1]) || (t[0] === u[1] && t[1] === u[0]);
    },

    // Tiles in `all` that are not in any of the given lists
    without(all, ...lists) {
        return all.filter(t => !lists.some(list => list.some(u => this.same(t, u))));
    },

    emptyLine() {
        return { tiles: [] };
    },

    // { left, right } values of the open ends, or null for an empty line
    ends(line) {
        if (!line.tiles.length) return null;
        return { left: line.tiles[0][0], right: line.tiles[line.tiles.length - 1][1] };
    },

    // The tile at an end ('left' | 'right')
    endTile(line, end) {
        return end === 'left' ? line.tiles[0] : line.tiles[line.tiles.length - 1];
    },

    // Adds `tile` at `end` with the half `outer` facing away from the line
    place(line, tile, end, outer) {
        const inner = outer === tile[0] ? tile[1] : tile[0];
        if (end === 'left') return { tiles: [[outer, inner], ...line.tiles] };
        return { tiles: [...line.tiles, [inner, outer]] };
    }
};

/**
 * Drawing tiles as HTML. Pips sit on a 3 x 3 grid, so faces up to 9 work.
 * Horizontal tiles show their halves side by side; vertical ones stacked.
 */
const DominoView = {
    LAYOUTS: [
        [],
        [4],
        [0, 8],
        [0, 4, 8],
        [0, 2, 6, 8],
        [0, 2, 4, 6, 8],
        [0, 2, 3, 5, 6, 8],
        [0, 2, 3, 4, 5, 6, 8],
        [0, 1, 2, 3, 5, 6, 7, 8],
        [0, 1, 2, 3, 4, 5, 6, 7, 8]
    ],

    half(n, horizontal) {
        // On a horizontal tile the layout is turned a quarter, so a six shows two rows of three
        const spots = this.LAYOUTS[n].map(i => (horizontal ? (i % 3) * 3 + Math.floor(i / 3) : i));
        let cells = '';
        for (let i = 0; i < 9; i++) cells += spots.includes(i) ? '<i class="pip"></i>' : '<i></i>';
        return `<span class="half">${cells}</span>`;
    },

    // options: { horizontal, cls, attrs, back }
    tile(t, options = {}) {
        const dir = options.horizontal ? 'h' : 'v';
        const classes = ['domino', dir, options.cls || ''].join(' ');
        const attrs = options.attrs || '';
        if (options.back) return `<div class="${classes} back" ${attrs}></div>`;
        return `<div class="${classes}" ${attrs}>${this.half(t[0], options.horizontal)}${this.half(t[1], options.horizontal)}</div>`;
    },

    // The line of play; doubles stand crosswise. `ghosts` holds HTML for the end targets
    line(line, ghosts = {}) {
        const tiles = line.tiles.map((t, i) => this.tile(t, {
            horizontal: !Dominoes.isDouble(t),
            cls: line.lastIdx === i ? 'last' : ''
        })).join('');
        return `<div class="domino-line">${ghosts.left || ''}${tiles}${ghosts.right || ''}</div>`;
    }
};
