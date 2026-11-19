/**
 * Product Rooms (Inshi no Heya) Logic Engine
 *
 * A level stores its solved grid and a room map (one letter per room); each room's
 * product is computed from the solution, so clues and answers can never disagree.
 * Every row and column holds 1..size once. Rooms are straight strips, so a digit
 * can never repeat inside a room.
 */
const InshiEngine = {
    parse(level) {
        const size = level.solution.length;
        const solution = level.solution.map(row => [...row].map(Number));
        const index = new Map();
        const rooms = [];
        const roomOf = level.rooms.map((row, r) => [...row].map((ch, c) => {
            if (!index.has(ch)) {
                index.set(ch, rooms.length);
                rooms.push({ cells: [], product: 1 });
            }
            const i = index.get(ch);
            rooms[i].cells.push([r, c]);
            rooms[i].product *= solution[r][c];
            return i;
        }));
        // The product is written in the room's top-left cell (first in reading order)
        rooms.forEach(room => { room.label = room.cells[0]; });
        return { size, solution, rooms, roomOf, tints: this.colorRooms(size, rooms, roomOf) };
    },

    // Gives neighbouring rooms different tints (greedy colouring with up to 4 tints)
    colorRooms(size, rooms, roomOf) {
        const tints = [];
        rooms.forEach((room, i) => {
            const taken = new Set();
            room.cells.forEach(([r, c]) => {
                [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dr, dc]) => {
                    const rr = r + dr, cc = c + dc;
                    if (rr < 0 || cc < 0 || rr >= size || cc >= size) return;
                    const j = roomOf[rr][cc];
                    if (j !== i && tints[j] !== undefined) taken.add(tints[j]);
                });
            });
            let t = 0;
            while (taken.has(t)) t++;
            tints[i] = t % 4;
        });
        return tints;
    },

    // Cells that share a row or column with (r, c) (rooms always lie inside one of them)
    peers(puzzle, r, c) {
        const result = [];
        for (let k = 0; k < puzzle.size; k++) {
            if (k !== c) result.push([r, k]);
            if (k !== r) result.push([k, c]);
        }
        return result;
    },

    /**
     * cells: Set of "r,c" keys that repeat a digit in a row or column, or lie in a room
     * whose digits no longer divide its product (or miss it once the room is full).
     * roomState[i]: 'bad', 'ok' (full and right) or '' (still open).
     */
    check(puzzle, values) {
        const n = puzzle.size;
        const cells = new Set();
        const markDuplicates = (group) => {
            const seen = new Map();
            group.forEach(([r, c]) => {
                const v = values[r][c];
                if (!v) return;
                if (seen.has(v)) {
                    cells.add(`${r},${c}`);
                    cells.add(seen.get(v));
                } else {
                    seen.set(v, `${r},${c}`);
                }
            });
        };
        for (let i = 0; i < n; i++) {
            markDuplicates(Array.from({ length: n }, (_, k) => [i, k]));
            markDuplicates(Array.from({ length: n }, (_, k) => [k, i]));
        }
        const roomState = puzzle.rooms.map(room => {
            const digits = room.cells.map(([r, c]) => values[r][c]);
            const product = digits.filter(Boolean).reduce((a, b) => a * b, 1);
            const full = digits.every(Boolean);
            if (room.product % product !== 0 || (full && product !== room.product)) {
                room.cells.forEach(([r, c]) => { if (values[r][c]) cells.add(`${r},${c}`); });
                return 'bad';
            }
            return full ? 'ok' : '';
        });
        return { cells, roomState };
    },

    isSolved(puzzle, values) {
        const allFilled = values.every(row => row.every(v => v > 0));
        return allFilled && this.check(puzzle, values).cells.size === 0;
    },

    /**
     * Counts solutions (up to `limit`) from the room products alone, ignoring the stored
     * solution: a backtracking search that always fills the cell with fewest options.
     */
    countSolutions(puzzle, limit = 2) {
        const n = puzzle.size;
        const all = ((1 << n) - 1) << 1;
        const rowUsed = new Array(n).fill(0);
        const colUsed = new Array(n).fill(0);
        const rooms = puzzle.rooms.map(room => ({ left: room.product, empty: room.cells.length }));
        const cellRoom = puzzle.roomOf.flat();
        const filled = new Array(n * n).fill(false);

        // Can `d` go into a room that still needs the factor `left` from `empty` cells?
        const fits = (room, d) => room.left % d === 0 && (room.empty > 1 || room.left === d);

        let count = 0;
        const search = () => {
            let best = -1, bestMask = 0, bestCount = 99;
            for (let i = 0; i < n * n; i++) {
                if (filled[i]) continue;
                const r = Math.floor(i / n), c = i % n;
                const room = rooms[cellRoom[i]];
                let mask = all & ~(rowUsed[r] | colUsed[c]);
                let cnt = 0;
                for (let d = 1; d <= n; d++) {
                    if (mask >> d & 1) {
                        if (fits(room, d)) cnt++;
                        else mask &= ~(1 << d);
                    }
                }
                if (cnt === 0) return;
                if (cnt < bestCount) { best = i; bestMask = mask; bestCount = cnt; if (cnt === 1) break; }
            }
            if (best < 0) { count++; return; }
            const r = Math.floor(best / n), c = best % n;
            const room = rooms[cellRoom[best]];
            for (let d = 1; d <= n && count < limit; d++) {
                if (!(bestMask >> d & 1)) continue;
                const bit = 1 << d;
                filled[best] = true;
                rowUsed[r] |= bit; colUsed[c] |= bit;
                room.left /= d; room.empty--;
                search();
                filled[best] = false;
                rowUsed[r] &= ~bit; colUsed[c] &= ~bit;
                room.left *= d; room.empty++;
            }
        };
        search();
        return count;
    }
};
