/**
 * Star Cube levels and rules; the maths and drawing live in common/stars3d.js.
 * Turns are about the screen axes, applied on the left: orientation = q * orientation.
 * A level sets: seed (star positions and target), stars, colored, lines,
 * mode 'quarter' (90° turns, target `par` turns away) or 'free' (drag; solved
 * within `tolerance` degrees), meter (show how close you are).
 */
const StarCube = {
    AXES: { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] },
    // The six quarter turns: [axis, direction]
    QUARTER_TURNS: [['x', 1], ['x', -1], ['y', 1], ['y', -1], ['z', 1], ['z', -1]],

    turn(axis, dir, degrees = 90) {
        return StarMath.axisAngle(this.AXES[axis], (dir * degrees * Math.PI) / 180);
    },

    // Every quarter-turn orientation by its fewest turns from the start (BFS over the 24)
    quarterDistances() {
        const start = StarMath.identity();
        const dist = new Map([[StarMath.key(start), { q: start, d: 0 }]]);
        const queue = [start];
        while (queue.length) {
            const q = queue.shift();
            const d = dist.get(StarMath.key(q)).d;
            this.QUARTER_TURNS.forEach(([axis, dir]) => {
                const next = StarMath.normalize(StarMath.mul(this.turn(axis, dir), q));
                const key = StarMath.key(next);
                if (!dist.has(key)) {
                    dist.set(key, { q: next, d: d + 1 });
                    queue.push(next);
                }
            });
        }
        return [...dist.values()];
    },

    setup(level) {
        const rand = StarMath.rng(level.seed);
        const stars = StarScene.makeStars(level, rand);
        const lines = level.lines ? stars.slice(1).map((_, i) => [i, i + 1]) : [];
        let target;
        let par = null;
        if (level.mode === 'quarter') {
            const options = this.quarterDistances().filter(o => o.d === level.par);
            target = options[Math.floor(rand() * options.length)].q;
            par = level.par;
        } else {
            // Far enough from the start that it takes real turning
            do { target = StarMath.randomOrientation(rand); } while (StarMath.angle(target, StarMath.identity()) < 70);
        }
        return {
            stars,
            lines,
            target,
            par,
            mode: level.mode,
            tolerance: level.tolerance ?? 10,
            meter: !!level.meter,
            orientation: StarMath.identity(),
            moves: 0
        };
    },

    isMatched(state) {
        const limit = state.mode === 'quarter' ? 1 : state.tolerance;
        return StarMath.angle(state.orientation, state.target) < limit;
    }
};
