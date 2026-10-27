/**
 * Hackenbush Logic Engine
 *
 * A position is a bitmask of the edges still standing (bit i = level.edges[i]),
 * so a level can have at most 30 edges. Blue may cut blue or green edges,
 * Red may cut red or green edges. Normal play: the player who cannot move loses.
 */
const HackenbushEngine = {
    create(level) {
        // shape (optional) only affects drawing: { bend } for arcs, { size, angle } for loops
        const edges = level.edges.map(([from, to, color, shape]) => ({ from, to, color, shape }));
        // Every point with y = 0 sits on the ground
        const ground = new Set(Object.keys(level.nodes).filter(id => level.nodes[id][1] === 0));
        return { edges, ground, memo: new Map() };
    },

    startMask(game) {
        return this.connected(game, (1 << game.edges.length) - 1);
    },

    isAlive(mask, i) {
        return (mask >> i & 1) === 1;
    },

    // Drops every edge that no longer has a path to the ground
    connected(game, mask) {
        const reached = new Set(game.ground);
        let changed = true;
        while (changed) {
            changed = false;
            game.edges.forEach((edge, i) => {
                if (this.isAlive(mask, i) && reached.has(edge.from) !== reached.has(edge.to)) {
                    reached.add(edge.from);
                    reached.add(edge.to);
                    changed = true;
                }
            });
        }
        return game.edges.reduce(
            (result, edge, i) => (this.isAlive(mask, i) && reached.has(edge.from) ? result | (1 << i) : result), 0);
    },

    canCut(edge, player) {
        return edge.color === player || edge.color === 'green';
    },

    moves(game, mask, player) {
        return game.edges
            .map((edge, i) => i)
            .filter(i => this.isAlive(mask, i) && this.canCut(game.edges[i], player));
    },

    cut(game, mask, i) {
        return this.connected(game, mask & ~(1 << i));
    },

    opponent(player) {
        return player === 'blue' ? 'red' : 'blue';
    },

    // True if `player`, moving now, wins with perfect play
    canWin(game, mask, player) {
        const key = mask * 2 + (player === 'blue' ? 1 : 0);
        if (game.memo.has(key)) return game.memo.get(key);
        const opponent = this.opponent(player);
        const result = this.moves(game, mask, player)
            .some(i => !this.canWin(game, this.cut(game, mask, i), opponent));
        game.memo.set(key, result);
        return result;
    },

    // A winning move if there is one, otherwise any legal move
    getMasterMove(game, mask, player) {
        const opponent = this.opponent(player);
        const winning = this.moves(game, mask, player)
            .filter(i => !this.canWin(game, this.cut(game, mask, i), opponent));
        return winning.length > 0 ? this.pickRandom(winning) : this.getNoviceMove(game, mask, player);
    },

    getNoviceMove(game, mask, player) {
        return this.pickRandom(this.moves(game, mask, player));
    },

    pickRandom(list) {
        return list[Math.floor(Math.random() * list.length)];
    }
};
