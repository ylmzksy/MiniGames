/**
 * Flash Grid rules: a pattern is a set of distinct cells of the grid.
 */
const FlashEngine = {
    pattern(cellCount, n, random = Math.random) {
        const cells = [...Array(cellCount).keys()];
        for (let i = cells.length - 1; i > 0; i--) {
            const j = Math.floor(random() * (i + 1));
            [cells[i], cells[j]] = [cells[j], cells[i]];
        }
        return new Set(cells.slice(0, n));
    }
};
