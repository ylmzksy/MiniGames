/**
 * Twin Rings rules. Rings of n beads overlap; where two rings cross they share a bead.
 * Bead k of a ring sits at angle k * 360/n around the ring's centre (0° pointing right,
 * angles growing clockwise on screen). Turning a ring clockwise (d = 1) moves every bead
 * on it one place on (slot k -> k + 1); shared beads travel with the ring that turns.
 *
 * A layout: n beads per ring, overlap o (rings cross at ±o·360/n from the line between
 * their centres, so centres are 2·cos(o·360/n) radii apart), and ring centres given as
 * [distance, direction°] from the origin, the distance counted in centre spacings.
 * Beads are numbered ring by ring, slot by slot, a shared bead keeping its first number.
 */
const RingsEngine = {
    LAYOUTS: {
        twin8:  { n: 8,  overlap: 1, centers: [[0, 0], [1, 0]] },
        twin10: { n: 10, overlap: 1, centers: [[0, 0], [1, 0]] },
        twin12: { n: 12, overlap: 1, centers: [[0, 0], [1, 0]] },
        chain8: { n: 8,  overlap: 1, centers: [[1, 180], [0, 0], [1, 0]] },
        tri10:  { n: 10, overlap: 1, centers: [[1, 144], [0, 0], [1, 36]] }
    },

    // Bead positions (radius 1) and, for every ring, its centre and the bead number in each slot
    build(name) {
        const lay = this.LAYOUTS[name];
        const n = lay.n;
        const spacing = 2 * Math.cos(lay.overlap * 2 * Math.PI / n);
        const rad = a => a * Math.PI / 180;
        const centers = lay.centers.map(([dist, dir]) => [dist * spacing * Math.cos(rad(dir)), dist * spacing * Math.sin(rad(dir))]);
        const pos = [];
        const rings = centers.map(([cx, cy]) => {
            const slots = [];
            for (let k = 0; k < n; k++) {
                const a = 2 * Math.PI * k / n;
                const p = [cx + Math.cos(a), cy + Math.sin(a)];
                let j = pos.findIndex(q => Math.abs(p[0] - q[0]) < 1e-3 && Math.abs(p[1] - q[1]) < 1e-3);
                if (j < 0) { pos.push(p); j = pos.length - 1; }
                slots.push(j);
            }
            return { cx, cy, slots };
        });
        return { n, pos, rings };
    },

    parse(level) {
        const geo = this.build(level.layout);
        const target = level.target.trim().split(/\s+/);
        const start = level.start.trim().split(/\s+/);
        return {
            ...geo,
            layout: level.layout,
            target,
            beads: start,
            numbered: target.every(t => /^\d+$/.test(t)),
            par: level.par
        };
    },

    // Returns the new bead array; also works on any array laid out like it (e.g. DOM elements)
    apply(beads, rings, move) {
        const out = beads.slice();
        const slots = rings[move.ring].slots;
        const n = slots.length;
        slots.forEach((p, k) => { out[slots[(k + move.d + n) % n]] = beads[p]; });
        return out;
    },

    inverse(move) {
        return { ring: move.ring, d: -move.d };
    },

    isSolved(beads, target) {
        return beads.every((t, i) => t === target[i]);
    }
};
