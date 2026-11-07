/**
 * Shikaku. Divide the grid into rectangles so that every rectangle contains
 * exactly one number and covers exactly that many cells. Rectangles never
 * overlap and together cover the whole grid.
 * Level: `numbers` rows with digits for clues and '.' for empty cells.
 * Player state: a list of rectangles { r, c, h, w }.
 */
const ShikakuEngine = {
    parse(level) {
        const numbers = level.numbers.map(row => [...row].map(ch => ch === '.' ? 0 : Number(ch)));
        return { width: numbers[0].length, height: numbers.length, numbers };
    },

    contains(rect, r, c) {
        return r >= rect.r && r < rect.r + rect.h && c >= rect.c && c < rect.c + rect.w;
    },

    overlaps(a, b) {
        return a.r < b.r + b.h && b.r < a.r + a.h && a.c < b.c + b.w && b.c < a.c + a.w;
    },

    // Numbers inside a rectangle
    cluesIn(puzzle, rect) {
        const out = [];
        for (let r = rect.r; r < rect.r + rect.h; r++) {
            for (let c = rect.c; c < rect.c + rect.w; c++) {
                if (puzzle.numbers[r][c]) out.push(puzzle.numbers[r][c]);
            }
        }
        return out;
    },

    isValid(puzzle, rect) {
        const clues = this.cluesIn(puzzle, rect);
        return clues.length === 1 && clues[0] === rect.w * rect.h;
    },

    // Adds a rectangle, removing every rectangle it overlaps
    add(rects, rect) {
        return [...rects.filter(x => !this.overlaps(x, rect)), rect];
    },

    rectAt(rects, r, c) {
        return rects.find(x => this.contains(x, r, c)) || null;
    },

    covered(rects) {
        return rects.reduce((sum, x) => sum + x.w * x.h, 0);
    },

    isSolved(puzzle, rects) {
        return this.covered(rects) === puzzle.width * puzzle.height && rects.every(x => this.isValid(puzzle, x));
    }
};
