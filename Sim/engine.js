/**
 * Sim. Six dots, fifteen edges. Players take turns coloring an edge; whoever
 * completes a triangle in their own color (three of the six dots) loses.
 * Ramsey's theorem guarantees someone does. Edges are indexed 0..14;
 * state.color[e] is 0 (free), 1 (blue, you) or 2 (red, AI).
 */
const SimEngine = {
    pairs: (() => { const out = []; for (let a = 0; a < 6; a++) for (let b = a + 1; b < 6; b++) out.push([a, b]); return out; })(),

    edgeIndex(a, b) {
        if (a > b) [a, b] = [b, a];
        return this.pairs.findIndex(([x, y]) => x === a && y === b);
    },

    triangles: null,
    allTriangles() {
        if (this.triangles) return this.triangles;
        const out = [];
        for (let a = 0; a < 6; a++) for (let b = a + 1; b < 6; b++) for (let c = b + 1; c < 6; c++) out.push([this.edgeIndex(a, b), this.edgeIndex(a, c), this.edgeIndex(b, c)]);
        return (this.triangles = out);
    },

    create(level) {
        const color = Array(15).fill(0);
        (level.red || []).forEach(([a, b]) => { color[this.edgeIndex(a, b)] = 2; });
        (level.blue || []).forEach(([a, b]) => { color[this.edgeIndex(a, b)] = 1; });
        return { color, turn: 1 };
    },

    // The triangle completed by edge e in color c, if any
    losingTriangle(color, e, c) {
        return this.allTriangles().find(t => t.includes(e) && t.every(x => color[x] === c)) || null;
    },

    hasTriangle(color, c) {
        return this.allTriangles().find(t => t.every(x => color[x] === c)) || null;
    },

    freeEdges(color) {
        return color.map((v, i) => v === 0 ? i : -1).filter(i => i >= 0);
    },

    // Value for the side to move: +1 = the mover can force the opponent into a triangle
    solve(color, mover, memo = this.memo || (this.memo = new Map())) {
        const key = color.join('') + mover;
        if (memo.has(key)) return memo.get(key);
        const free = this.freeEdges(color);
        let best = -1;
        for (const e of free) {
            color[e] = mover;
            let value;
            if (this.losingTriangle(color, e, mover)) value = -1;
            else value = -this.solve(color, 3 - mover, memo);
            color[e] = 0;
            if (value > best) best = value;
            if (best === 1) break;
        }
        if (!free.length) best = 0;
        memo.set(key, best);
        return best;
    },

    getNoviceMove(state) {
        const free = this.freeEdges(state.color);
        const safe = free.filter(e => { state.color[e] = 2; const bad = this.losingTriangle(state.color, e, 2); state.color[e] = 0; return !bad; });
        const pool = safe.length ? safe : free;
        return pool[Math.floor(Math.random() * pool.length)];
    },

    getMasterMove(state) {
        const free = this.freeEdges(state.color);
        const scored = free.map(e => {
            state.color[e] = 2;
            let value;
            if (this.losingTriangle(state.color, e, 2)) value = -2;
            else value = -this.solve(state.color, 1);
            state.color[e] = 0;
            return { e, value };
        });
        const best = Math.max(...scored.map(s => s.value));
        const top = scored.filter(s => s.value === best);
        return top[Math.floor(Math.random() * top.length)].e;
    }
};
