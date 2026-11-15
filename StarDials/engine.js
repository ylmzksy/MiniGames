/**
 * Star Dials rules. Each dial turns the cube by any angle about its own axis.
 * The dials are nested like a gimbal: dial 0 is outermost and fixed in
 * space, and each inner dial's axis is carried round by the dials outside
 * it. So orientation = R0(a0) * R1(a1) * R2(a2), and turning dial k always
 * spins the cube about the rod drawn for dial k.
 * Every level has three dials, so the cube can always turn about three axes.
 * A level sets: seed, stars, colored, lines, axes (three of 'x' | 'y' | 'z',
 * or tilted: 3 for random slanted axes), moved (indexes of the dials the
 * target is turned on; the rest stay at 0, all when left out), tolerance
 * (degrees), targetRods (show the rods in the target picture), meter.
 */
const StarDials = {
    AXES: { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] },
    COLORS: ['#ff6b6b', '#5ee08a', '#5aa9ff'],

    // Random axes at least 40° from each other and from the screen axes, so none is a plain x, y or z
    tiltedAxes(n, rand) {
        const axes = [];
        const far = (a, b, deg) => Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) < Math.cos((deg * Math.PI) / 180);
        while (axes.length < n) {
            const v = [rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1];
            const len = Math.hypot(...v);
            if (len < 0.2 || len > 1) continue;
            const axis = v.map(c => c / len);
            if (!Object.values(this.AXES).every(a => far(axis, a, 20))) continue;
            if (!axes.every(a => far(axis, a, 40))) continue;
            axes.push(axis);
        }
        return axes;
    },

    // A target angle that isn't close to a quarter turn or to the start
    targetAngle(rand) {
        for (;;) {
            const a = Math.floor(rand() * 360);
            const offQuarter = Math.min(a % 90, 90 - (a % 90));
            if (offQuarter >= 15 && a >= 40 && a <= 320) return a;
        }
    },

    setup(level) {
        const rand = StarMath.rng(level.seed);
        const stars = StarScene.makeStars(level, rand);
        const axes = level.tilted ? this.tiltedAxes(level.tilted, rand) : level.axes.map(a => this.AXES[a]);
        const dials = axes.map((axis, i) => ({ axis, color: this.COLORS[i] }));
        const moved = level.moved ?? dials.map((_, i) => i);
        const targetAngles = dials.map((_, i) => (moved.includes(i) ? this.targetAngle(rand) : 0));
        return {
            stars,
            lines: level.lines ? stars.slice(1).map((_, i) => [i, i + 1]) : [],
            dials,
            angles: dials.map(() => 0),
            targetAngles,
            target: this.orientation(dials, targetAngles),
            tolerance: level.tolerance ?? 5,
            targetRods: level.targetRods !== false,
            meter: !!level.meter
        };
    },

    orientation(dials, angles) {
        return dials.reduce((q, dial, i) =>
            StarMath.normalize(StarMath.mul(q, StarMath.axisAngle(dial.axis, (angles[i] * Math.PI) / 180))),
        StarMath.identity());
    },

    // Where each dial's rod points for these angles: its axis carried by the dials outside it
    rods(dials, angles) {
        let carry = StarMath.identity();
        return dials.map((dial, i) => {
            const rod = { dir: StarMath.apply(carry, dial.axis), color: dial.color };
            carry = StarMath.mul(carry, StarMath.axisAngle(dial.axis, (angles[i] * Math.PI) / 180));
            return rod;
        });
    },

    offBy(state) {
        return StarMath.angle(this.orientation(state.dials, state.angles), state.target);
    },

    isMatched(state) {
        return this.offBy(state) < state.tolerance;
    },

    // Wraps an angle into 0..359.9
    wrap(a) {
        return ((a % 360) + 360) % 360;
    },

    // Signed shortest difference b - a in degrees
    diff(a, b) {
        return ((b - a + 540) % 360) - 180;
    }
};
