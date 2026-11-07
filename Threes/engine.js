/**
 * Threes. Tiles slide one step in the chosen direction; a 1 and a 2 merge
 * into a 3, and two equal tiles of 3 or more merge into their sum. After each
 * move the next tile enters from the opposite edge in a line that moved.
 * The game ends when no direction moves anything.
 */
const ThreesEngine = {
    rng(seed) {
        let a = seed >>> 0;
        return () => {
            a = (a + 0x6D2B79F5) >>> 0;
            let t = a;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    },

    create(level) {
        const state = { size: 4, board: Array.from({ length: 4 }, () => Array(4).fill(0)), target: level.target, rand: this.rng(level.seed), bag: [], next: 0 };
        for (let i = 0; i < 9; i++) {
            const empty = [];
            state.board.forEach((row, r) => row.forEach((v, c) => { if (!v) empty.push([r, c]); }));
            const [r, c] = empty[Math.floor(state.rand() * empty.length)];
            state.board[r][c] = this.draw(state);
        }
        state.next = this.draw(state);
        return state;
    },

    // Tiles come from a shuffled bag of four 1s, 2s and 3s
    draw(state) {
        if (!state.bag.length) {
            state.bag = [1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3];
            for (let i = state.bag.length - 1; i > 0; i--) {
                const j = Math.floor(state.rand() * (i + 1));
                [state.bag[i], state.bag[j]] = [state.bag[j], state.bag[i]];
            }
        }
        return state.bag.pop();
    },

    canMerge(a, b) {
        if (!a || !b) return false;
        if ((a === 1 && b === 2) || (a === 2 && b === 1)) return true;
        return a === b && a >= 3;
    },

    // Shifts one line toward index 0 by one step; returns whether it moved
    shiftLine(line) {
        for (let i = 1; i < line.length; i++) {
            if (!line[i]) continue;
            if (!line[i - 1]) {
                // the whole tail slides one step
                for (let j = i; j < line.length; j++) { line[j - 1] = line[j]; line[j] = 0; }
                return true;
            }
            if (this.canMerge(line[i - 1], line[i])) {
                line[i - 1] += line[i];
                for (let j = i + 1; j < line.length; j++) { line[j - 1] = line[j]; line[j] = 0; }
                return true;
            }
        }
        return false;
    },

    lines(dir) {
        const n = 4;
        const out = [];
        for (let i = 0; i < n; i++) {
            const cells = [];
            for (let j = 0; j < n; j++) {
                if (dir === 'left') cells.push([i, j]);
                else if (dir === 'right') cells.push([i, n - 1 - j]);
                else if (dir === 'up') cells.push([j, i]);
                else cells.push([n - 1 - j, i]);
            }
            out.push(cells);
        }
        return out;
    },

    // Applies a move and brings in the next tile; returns whether anything moved
    move(state, dir) {
        const movedLines = [];
        this.lines(dir).forEach((cells, index) => {
            const line = cells.map(([r, c]) => state.board[r][c]);
            if (this.shiftLine(line)) {
                movedLines.push(cells);
                cells.forEach(([r, c], i) => { state.board[r][c] = line[i]; });
            }
        });
        if (!movedLines.length) return false;
        // the new tile enters at the far end (index 3) of a random line that moved
        const cells = movedLines[Math.floor(state.rand() * movedLines.length)];
        const [r, c] = cells[3];
        state.board[r][c] = state.next;
        state.next = this.draw(state);
        return true;
    },

    canMove(state) {
        return ['up', 'down', 'left', 'right'].some(dir =>
            this.lines(dir).some(cells => this.shiftLine(cells.map(([r, c]) => state.board[r][c]))));
    },

    tileScore(v) {
        return v >= 3 ? 3 ** (Math.log2(v / 3) + 1) : 0;
    },

    score(board) {
        return board.flat().reduce((s, v) => s + this.tileScore(v), 0);
    },

    maxTile(board) {
        return Math.max(...board.flat());
    }
};
