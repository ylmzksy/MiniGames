/**
 * Star Battle. The grid is split into regions. Place stars so that every row,
 * every column and every region holds exactly `stars` stars, and no two stars
 * touch, not even diagonally. Player marks: 'star', 'dot' (a note meaning
 * "no star here") or null.
 */
const StarBattleEngine = {
    parse(level) {
        const regions = level.regions.map(row => [...row]);
        const size = regions.length;
        const ids = [...new Set(regions.flat())];
        return { size, stars: level.stars, regions, regionIds: ids };
    },

    // Stars per row, column and region
    counts(puzzle, marks) {
        const n = puzzle.size;
        const rows = Array(n).fill(0);
        const cols = Array(n).fill(0);
        const regions = {};
        puzzle.regionIds.forEach(id => { regions[id] = 0; });
        for (let r = 0; r < n; r++) {
            for (let c = 0; c < n; c++) {
                if (marks[r][c] !== 'star') continue;
                rows[r]++;
                cols[c]++;
                regions[puzzle.regions[r][c]]++;
            }
        }
        return { rows, cols, regions };
    },

    // Keys "r,c" of stars that touch another star (including diagonally)
    touching(puzzle, marks) {
        const bad = new Set();
        const n = puzzle.size;
        for (let r = 0; r < n; r++) {
            for (let c = 0; c < n; c++) {
                if (marks[r][c] !== 'star') continue;
                for (let dr = -1; dr <= 1; dr++) {
                    for (let dc = -1; dc <= 1; dc++) {
                        if (!dr && !dc) continue;
                        if (marks[r + dr]?.[c + dc] === 'star') bad.add(`${r},${c}`);
                    }
                }
            }
        }
        return bad;
    },

    isSolved(puzzle, marks) {
        if (this.touching(puzzle, marks).size) return false;
        const { rows, cols, regions } = this.counts(puzzle, marks);
        return rows.every(v => v === puzzle.stars) && cols.every(v => v === puzzle.stars)
            && Object.values(regions).every(v => v === puzzle.stars);
    }
};
