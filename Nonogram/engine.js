/**
 * Nonogram (Picross). The numbers beside a row or column are the lengths of
 * its runs of filled cells, in order, with at least one empty cell between
 * runs. Fill the grid so every line matches its numbers.
 * Player marks: 'filled', 'cross' (a note meaning "empty") or null.
 * Unmarked and crossed cells both count as empty when lines are checked.
 */
const NonogramEngine = {
    parse(level) {
        const solution = level.picture.map(row => [...row].map(ch => ch === '#'));
        const height = solution.length;
        const width = solution[0].length;
        const rows = solution.map(row => this.runs(row));
        const cols = Array.from({ length: width }, (_, c) => this.runs(solution.map(row => row[c])));
        return { width, height, rows, cols };
    },

    runs(line) {
        const out = [];
        let n = 0;
        line.forEach(v => { if (v) n++; else if (n) { out.push(n); n = 0; } });
        if (n) out.push(n);
        return out.length ? out : [0];
    },

    // All ways to lay the runs along a line of the given length
    placements(clue, length, cache = this.cache || (this.cache = new Map())) {
        const key = `${clue.join(',')}|${length}`;
        if (cache.has(key)) return cache.get(key);
        const out = [];
        if (clue.length === 1 && clue[0] === 0) {
            out.push(Array(length).fill(false));
        } else {
            const rec = (i, cur) => {
                if (i === clue.length) { out.push([...cur, ...Array(length - cur.length).fill(false)]); return; }
                const rest = clue.slice(i).reduce((a, b) => a + b, 0) + (clue.length - i - 1);
                for (let start = cur.length; start + rest <= length; start++) {
                    const line = [...cur, ...Array(start - cur.length).fill(false), ...Array(clue[i]).fill(true)];
                    if (i < clue.length - 1) line.push(false);
                    rec(i + 1, line);
                }
            };
            rec(0, []);
        }
        cache.set(key, out);
        return out;
    },

    // 'ok' when the filled cells form exactly the clue, 'bad' when no placement fits the marks
    lineState(clue, marks) {
        const filled = marks.map(m => m === 'filled');
        if (this.runs(filled).join(',') === clue.join(',')) return 'ok';
        const fits = this.placements(clue, marks.length).some(p => p.every((v, i) =>
            (marks[i] !== 'filled' || v) && (marks[i] !== 'cross' || !v)));
        return fits ? '' : 'bad';
    },

    column(marks, c) {
        return marks.map(row => row[c]);
    },

    isSolved(puzzle, marks) {
        return puzzle.rows.every((clue, r) => this.lineState(clue, marks[r]) === 'ok')
            && puzzle.cols.every((clue, c) => this.lineState(clue, this.column(marks, c)) === 'ok');
    }
};
