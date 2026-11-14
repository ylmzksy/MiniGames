/**
 * Water jug puzzles. Jugs have fixed capacities and no markings. A move
 * fills a jug from the tap, empties a jug, or pours one jug into another
 * until the source is empty or the target is full. The goal is to end up
 * with exactly the target amount in any jug (or in a named jug).
 */
const JugEngine = {
    create(level) {
        return { capacities: [...level.jugs], amounts: level.jugs.map((_, i) => (level.start || [])[i] || 0), target: level.target, noTap: !!level.noTap };
    },

    key(amounts) {
        return amounts.join(',');
    },

    // All moves as { type: 'fill' | 'empty' | 'pour', from, to }
    moves(state) {
        const out = [];
        state.capacities.forEach((cap, i) => {
            // Levels without a tap only allow pouring between the jugs
            if (!state.noTap && state.amounts[i] < cap) out.push({ type: 'fill', from: i });
            if (!state.noTap && state.amounts[i] > 0) out.push({ type: 'empty', from: i });
            state.capacities.forEach((capTo, j) => {
                if (i !== j && state.amounts[i] > 0 && state.amounts[j] < capTo) out.push({ type: 'pour', from: i, to: j });
            });
        });
        return out;
    },

    apply(state, move) {
        const amounts = [...state.amounts];
        if (move.type === 'fill') amounts[move.from] = state.capacities[move.from];
        else if (move.type === 'empty') amounts[move.from] = 0;
        else {
            const space = state.capacities[move.to] - amounts[move.to];
            const poured = Math.min(space, amounts[move.from]);
            amounts[move.from] -= poured;
            amounts[move.to] += poured;
        }
        return { ...state, amounts };
    },

    isSolved(state) {
        return state.amounts.includes(state.target);
    },

    // Shortest solution from a state as a list of moves, or null
    solve(state) {
        const start = this.key(state.amounts);
        const prev = new Map([[start, null]]);
        const queue = [state];
        while (queue.length) {
            const cur = queue.shift();
            if (this.isSolved(cur)) {
                const path = [];
                for (let k = this.key(cur.amounts); prev.get(k); k = prev.get(k).key) path.push(prev.get(k).move);
                return path.reverse();
            }
            for (const move of this.moves(cur)) {
                const next = this.apply(cur, move);
                const k = this.key(next.amounts);
                if (!prev.has(k)) { prev.set(k, { key: this.key(cur.amounts), move }); queue.push(next); }
            }
        }
        return null;
    }
};
