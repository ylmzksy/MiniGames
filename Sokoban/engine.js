/**
 * Sokoban rules. Levels use the standard text format:
 *   #  wall        @  player        $  box
 *   .  goal        +  player on goal   *  box on goal
 *   space: floor (cells not reachable from the player are drawn as empty space)
 */
const SokobanEngine = {
    directions: {
        up: [-1, 0],
        down: [1, 0],
        left: [0, -1],
        right: [0, 1]
    },

    // Builds the static map and the initial movable state from the level's rows
    parse(level) {
        const height = level.map.length;
        const width = Math.max(...level.map.map(row => row.length));
        const walls = [];
        const goals = [];
        const boxes = [];
        let player = null;

        for (let r = 0; r < height; r++) {
            walls.push([]);
            goals.push([]);
            for (let c = 0; c < width; c++) {
                const ch = level.map[r][c] ?? ' ';
                walls[r][c] = ch === '#';
                goals[r][c] = ch === '.' || ch === '*' || ch === '+';
                if (ch === '$' || ch === '*') boxes.push([r, c]);
                if (ch === '@' || ch === '+') player = [r, c];
            }
        }

        const floor = this.reachableFloor(walls, player);
        return {
            width, height, walls, goals, floor,
            state: { player, boxes }
        };
    },

    // Floor cells connected to the player, so the void outside the walls can be left blank
    reachableFloor(walls, start) {
        const floor = walls.map(row => row.map(() => false));
        const queue = [start];
        floor[start[0]][start[1]] = true;
        while (queue.length) {
            const [r, c] = queue.shift();
            Object.values(this.directions).forEach(([dr, dc]) => {
                const nr = r + dr;
                const nc = c + dc;
                if (nr < 0 || nc < 0 || nr >= walls.length || nc >= walls[0].length) return;
                if (walls[nr][nc] || floor[nr][nc]) return;
                floor[nr][nc] = true;
                queue.push([nr, nc]);
            });
        }
        return floor;
    },

    boxAt(state, r, c) {
        return state.boxes.findIndex(([br, bc]) => br === r && bc === c);
    },

    isWall(puzzle, r, c) {
        return r < 0 || c < 0 || r >= puzzle.height || c >= puzzle.width || puzzle.walls[r][c];
    },

    // Returns the new state and whether a box was pushed, or null if the move is blocked
    move(puzzle, state, dir) {
        const [dr, dc] = this.directions[dir];
        const [pr, pc] = state.player;
        const nr = pr + dr;
        const nc = pc + dc;
        if (this.isWall(puzzle, nr, nc)) return null;

        const boxes = state.boxes.map(box => [...box]);
        const boxIdx = this.boxAt(state, nr, nc);
        let pushed = false;
        if (boxIdx >= 0) {
            const br = nr + dr;
            const bc = nc + dc;
            if (this.isWall(puzzle, br, bc) || this.boxAt(state, br, bc) >= 0) return null;
            boxes[boxIdx] = [br, bc];
            pushed = true;
        }

        return { state: { player: [nr, nc], boxes }, pushed };
    },

    isSolved(puzzle, state) {
        return state.boxes.every(([r, c]) => puzzle.goals[r][c]);
    }
};
