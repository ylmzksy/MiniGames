/**
 * Gravity Room rules. The room is a grid in its own frame; turning it changes
 * which way "down" points inside it. After every quarter turn all blocks fall
 * that way until they hit a wall, the room's edge or another block. Blocks
 * nearest the floor settle first, so a stack keeps its order.
 * turns counts quarter turns clockwise (any integer); gravity is GRAV[turns mod 4]
 * as (dx, dy) in the room's frame: down, right, up, left.
 * Level generator (BFS) uses the same rule, so `par` is exact.
 */
const GravityEngine = {
    GRAV: [[0, 1], [1, 0], [0, -1], [-1, 0]],
    COLORS: 'rgby',

    parse(level) {
        const height = level.map.length;
        const width = level.map[0].length;
        const walls = new Set();
        const blocks = [];
        const goal = [];
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const ch = level.map[y][x];
                if (ch === '#') walls.add(`${x},${y}`);
                else if (this.COLORS.includes(ch) || ch === 'o') blocks.push({ id: blocks.length, c: ch, x, y });
                const g = level.goal[y][x];
                if (this.COLORS.includes(g)) goal.push({ c: g, x, y });
            }
        }
        const state = { width, height, walls, blocks, goal, par: level.par, turns: 0, moves: 0 };
        this.settle(state);
        return state;
    },

    gravity(state) {
        return this.GRAV[((state.turns % 4) + 4) % 4];
    },

    isFree(state, x, y, occupied) {
        return x >= 0 && y >= 0 && x < state.width && y < state.height &&
            !state.walls.has(`${x},${y}`) && !occupied.has(`${x},${y}`);
    },

    // Lets every block fall; returns true if any moved
    settle(state) {
        const [dx, dy] = this.gravity(state);
        const occupied = new Set(state.blocks.map(b => `${b.x},${b.y}`));
        const order = [...state.blocks].sort((a, b) => (b.x * dx + b.y * dy) - (a.x * dx + a.y * dy));
        let moved = false;
        order.forEach(block => {
            occupied.delete(`${block.x},${block.y}`);
            while (this.isFree(state, block.x + dx, block.y + dy, occupied)) {
                block.x += dx;
                block.y += dy;
                moved = true;
            }
            occupied.add(`${block.x},${block.y}`);
        });
        return moved;
    },

    // dir: +1 clockwise, -1 counter-clockwise. Turning only changes gravity; call settle() to let blocks fall
    turn(state, dir) {
        state.turns += dir;
        state.moves++;
    },

    blockAt(state, x, y) {
        return state.blocks.find(b => b.x === x && b.y === y);
    },

    isOnGoal(state, block) {
        return state.goal.some(g => g.x === block.x && g.y === block.y && g.c === block.c);
    },

    isSolved(state) {
        return state.goal.every(g => {
            const block = this.blockAt(state, g.x, g.y);
            return block && block.c === g.c;
        });
    },

    snapshot(state) {
        return { turns: state.turns, moves: state.moves, blocks: state.blocks.map(b => ({ ...b })) };
    },

    restore(state, snap) {
        state.turns = snap.turns;
        state.moves = snap.moves;
        state.blocks = snap.blocks.map(b => ({ ...b }));
    }
};
