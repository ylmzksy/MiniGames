/**
 * Suguru rules. The grid is split into regions of 1 to 5 cells. A region of
 * size k holds each digit 1..k exactly once, and two equal digits never touch,
 * not even diagonally. Values are null (empty) or a digit.
 */
const SuguruEngine = {
    parse(level) {
        const letters = level.regions.map(row => [...row]);
        const height = letters.length;
        const width = letters[0].length;
        const ids = [...new Set(letters.flat())];
        const region = letters.map(row => row.map(ch => ids.indexOf(ch)));
        const regionCells = ids.map(() => []);
        region.forEach((row, y) => row.forEach((id, x) => regionCells[id].push([x, y])));
        const givens = level.givens.map(row => [...row].map(ch => (ch === '.' ? null : Number(ch))));
        return { width, height, region, regionCells, givens, colors: this.colorRegions(region, regionCells.length) };
    },

    sizeAt(puzzle, x, y) {
        return puzzle.regionCells[puzzle.region[y][x]].length;
    },

    // The up to eight cells around (x, y)
    around(puzzle, x, y) {
        const out = [];
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                const nx = x + dx;
                const ny = y + dy;
                if ((dx || dy) && nx >= 0 && ny >= 0 && nx < puzzle.width && ny < puzzle.height) out.push([nx, ny]);
            }
        }
        return out;
    },

    // Gives each region a tint index so that regions sharing an edge never share a tint
    colorRegions(region, count) {
        const touching = Array.from({ length: count }, () => new Set());
        region.forEach((row, y) => row.forEach((id, x) => {
            if (x + 1 < row.length && row[x + 1] !== id) { touching[id].add(row[x + 1]); touching[row[x + 1]].add(id); }
            if (y + 1 < region.length && region[y + 1][x] !== id) { touching[id].add(region[y + 1][x]); touching[region[y + 1][x]].add(id); }
        }));
        const colors = [];
        for (let id = 0; id < count; id++) {
            const taken = new Set([...touching[id]].map(o => colors[o]));
            let c = id % 5;
            while (taken.has(c)) c = (c + 1) % 5;
            colors.push(c);
        }
        return colors;
    },

    /**
     * Finds broken rules: digits repeated in a region, equal digits touching,
     * and digits too big for their region.
     * Returns { bad: Set of "x,y", full }.
     */
    check(puzzle, values) {
        const bad = new Set();
        puzzle.regionCells.forEach(cells => {
            const seen = {};
            cells.forEach(([x, y]) => {
                const v = values[y][x];
                if (v === null) return;
                if (v > cells.length) bad.add(`${x},${y}`);
                (seen[v] = seen[v] || []).push(`${x},${y}`);
            });
            Object.values(seen).forEach(list => { if (list.length > 1) list.forEach(k => bad.add(k)); });
        });
        for (let y = 0; y < puzzle.height; y++) {
            for (let x = 0; x < puzzle.width; x++) {
                const v = values[y][x];
                if (v === null) continue;
                this.around(puzzle, x, y).forEach(([nx, ny]) => {
                    if (values[ny][nx] === v) { bad.add(`${x},${y}`); bad.add(`${nx},${ny}`); }
                });
            }
        }
        const full = values.every(row => row.every(v => v !== null));
        return { bad, full };
    },

    isSolved(puzzle, values) {
        const { bad, full } = this.check(puzzle, values);
        return full && !bad.size;
    }
};
