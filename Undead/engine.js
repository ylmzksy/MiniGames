/**
 * Undead rules. Mirrors (/ and \) are fixed; every other cell holds one monster:
 *   G ghost    seen only in mirrors (after the sight line has been reflected)
 *   V vampire  seen only directly (before any reflection)
 *   Z zombie   always seen
 * Each edge clue is the number of monsters seen along the sight line that
 * enters there. A cell counts each time the line passes through it.
 * Levels give the solved grid; clues and monster counts are derived from it.
 */
const UndeadEngine = {
    monsters: ['G', 'V', 'Z'],
    sides: ['top', 'right', 'bottom', 'left'],

    parse(level) {
        const rows = level.solution;
        const height = rows.length;
        const width = rows[0].length;
        const mirrors = rows.map(row => [...row].map(ch => (ch === '/' || ch === '\\') ? ch : null));
        const solution = rows.map(row => [...row].map(ch => this.monsters.includes(ch) ? ch : null));

        const counts = { G: 0, V: 0, Z: 0 };
        solution.flat().forEach(m => { if (m) counts[m]++; });

        const puzzle = { width, height, mirrors, counts, solution };
        puzzle.clues = this.allPorts(width, height).map(port => {
            const path = this.tracePath(puzzle, port);
            return { ...port, path, count: this.countSeen(path, solution) };
        });
        return puzzle;
    },

    allPorts(width, height) {
        return [
            ...Array.from({ length: width }, (_, i) => ({ side: 'top', index: i })),
            ...Array.from({ length: height }, (_, i) => ({ side: 'right', index: i })),
            ...Array.from({ length: width }, (_, i) => ({ side: 'bottom', index: i })),
            ...Array.from({ length: height }, (_, i) => ({ side: 'left', index: i }))
        ];
    },

    // The cells a sight line visits, with whether it has been reflected yet
    tracePath(puzzle, port) {
        const starts = {
            top: { pos: [-1, port.index], dir: [1, 0] },
            bottom: { pos: [puzzle.height, port.index], dir: [-1, 0] },
            left: { pos: [port.index, -1], dir: [0, 1] },
            right: { pos: [port.index, puzzle.width], dir: [0, -1] }
        };
        let [r, c] = starts[port.side].pos;
        let [dr, dc] = starts[port.side].dir;
        let reflected = false;
        const path = [];

        while (true) {
            r += dr;
            c += dc;
            if (r < 0 || c < 0 || r >= puzzle.height || c >= puzzle.width) return path;
            const mirror = puzzle.mirrors[r][c];
            if (mirror === '/') {
                [dr, dc] = [-dc, -dr];
                reflected = true;
            } else if (mirror === '\\') {
                [dr, dc] = [dc, dr];
                reflected = true;
            } else {
                path.push({ r, c, reflected });
            }
        }
    },

    isSeen(monster, reflected) {
        return monster === 'Z' || (reflected ? monster === 'G' : monster === 'V');
    },

    countSeen(path, grid) {
        return path.filter(({ r, c, reflected }) => grid[r][c] && this.isSeen(grid[r][c], reflected)).length;
    },

    // 'ok' when the clue is met and its path is full, 'bad' when it can no longer be met
    clueState(clue, grid) {
        const seen = this.countSeen(clue.path, grid);
        const open = clue.path.filter(({ r, c }) => !grid[r][c]).length;
        if (seen > clue.count || seen + open < clue.count) return 'bad';
        if (open === 0) return seen === clue.count ? 'ok' : 'bad';
        return '';
    },

    placed(grid) {
        const counts = { G: 0, V: 0, Z: 0 };
        grid.flat().forEach(m => { if (m) counts[m]++; });
        return counts;
    },

    isSolved(puzzle, grid) {
        for (let r = 0; r < puzzle.height; r++) {
            for (let c = 0; c < puzzle.width; c++) {
                if (!puzzle.mirrors[r][c] && !grid[r][c]) return false;
            }
        }
        const placed = this.placed(grid);
        if (this.monsters.some(m => placed[m] !== puzzle.counts[m])) return false;
        return puzzle.clues.every(clue => this.countSeen(clue.path, grid) === clue.count);
    }
};
