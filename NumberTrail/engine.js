/**
 * Number Trail rules: numbers 1..n are placed on distinct cells of the grid.
 * place() returns the cell of each number: cells[0] holds 1, cells[1] holds 2, ...
 */
const TrailEngine = {
    place(cellCount, n, random = Math.random) {
        const cells = [...Array(cellCount).keys()];
        for (let i = cells.length - 1; i > 0; i--) {
            const j = Math.floor(random() * (i + 1));
            [cells[i], cells[j]] = [cells[j], cells[i]];
        }
        return cells.slice(0, n);
    }
};
