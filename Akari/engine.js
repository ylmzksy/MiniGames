/**
 * Akari (Light Up). Place bulbs on white cells so that:
 *   1. every white cell is lit: a bulb lights its row and column up to the next black cell
 *   2. no bulb shines on another bulb
 *   3. a numbered black cell has exactly that many bulbs orthogonally next to it
 * Level map: '#' black, '0'..'4' numbered black, '.' white.
 * Player marks: 'bulb', 'dot' (a note meaning "no bulb here") or null.
 */
const AkariEngine = {
    directions: [[-1, 0], [1, 0], [0, -1], [0, 1]],

    parse(level) {
        const rows = level.map;
        const height = rows.length;
        const width = rows[0].length;
        const black = rows.map(row => [...row].map(ch => ch !== '.'));
        const numbers = rows.map(row => [...row].map(ch => /[0-4]/.test(ch) ? Number(ch) : null));
        return { width, height, black, numbers };
    },

    // Cells lit from (r, c) along the four directions, not including (r, c) itself
    beam(puzzle, r, c) {
        const out = [];
        this.directions.forEach(([dr, dc]) => {
            let nr = r + dr;
            let nc = c + dc;
            while (nr >= 0 && nc >= 0 && nr < puzzle.height && nc < puzzle.width && !puzzle.black[nr][nc]) {
                out.push([nr, nc]);
                nr += dr;
                nc += dc;
            }
        });
        return out;
    },

    // Set of "r,c" lit by the bulbs, and bulbs that shine on each other
    light(puzzle, marks) {
        const lit = new Set();
        const clashing = new Set();
        marks.forEach((row, r) => row.forEach((m, c) => {
            if (m !== 'bulb') return;
            lit.add(`${r},${c}`);
            this.beam(puzzle, r, c).forEach(([nr, nc]) => {
                lit.add(`${nr},${nc}`);
                if (marks[nr][nc] === 'bulb') { clashing.add(`${r},${c}`); clashing.add(`${nr},${nc}`); }
            });
        }));
        return { lit, clashing };
    },

    neighbors(puzzle, r, c) {
        return this.directions
            .map(([dr, dc]) => [r + dr, c + dc])
            .filter(([nr, nc]) => nr >= 0 && nc >= 0 && nr < puzzle.height && nc < puzzle.width && !puzzle.black[nr][nc]);
    },

    // 'ok' when a number has exactly its bulbs and no open neighbor left, 'bad' when it cannot be met
    numberState(puzzle, marks, r, c) {
        const n = puzzle.numbers[r][c];
        const around = this.neighbors(puzzle, r, c);
        const bulbs = around.filter(([nr, nc]) => marks[nr][nc] === 'bulb').length;
        const open = around.filter(([nr, nc]) => marks[nr][nc] === null).length;
        if (bulbs > n || bulbs + open < n) return 'bad';
        return bulbs === n ? 'ok' : '';
    },

    isSolved(puzzle, marks) {
        const { lit, clashing } = this.light(puzzle, marks);
        if (clashing.size) return false;
        for (let r = 0; r < puzzle.height; r++) {
            for (let c = 0; c < puzzle.width; c++) {
                if (puzzle.black[r][c]) {
                    if (puzzle.numbers[r][c] !== null && this.numberState(puzzle, marks, r, c) === 'bad') return false;
                    if (puzzle.numbers[r][c] !== null && this.neighbors(puzzle, r, c).filter(([nr, nc]) => marks[nr][nc] === 'bulb').length !== puzzle.numbers[r][c]) return false;
                } else if (!lit.has(`${r},${c}`)) {
                    return false;
                }
            }
        }
        return true;
    }
};
