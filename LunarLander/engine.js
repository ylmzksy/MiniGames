/**
 * Lunar Lander. Steer the lander down onto a flat pad. Gravity pulls it down,
 * the engine pushes along its nose and burns fuel, and the lander may rotate.
 * A landing counts when both feet are on a pad, the lander is nearly upright,
 * and it is moving slowly; anything else is a crash.
 * World units are pixels on a WIDTH x HEIGHT canvas, y pointing down.
 */
const LanderEngine = {
    WIDTH: 640,
    HEIGHT: 400,
    THRUST: 180,       // px/s² at full burn
    ROTATE: 2.4,       // rad/s
    BURN: 22,          // fuel units per second
    MAX_VY: 45,        // safe landing speeds and tilt
    MAX_VX: 30,
    MAX_TILT: 0.25,
    FOOT: 10,          // half distance between the feet
    DT: 1 / 30,

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

    // Jagged terrain from random control points, with flat pads cut into it
    create(level) {
        const rand = this.rng(level.seed);
        const step = 20;
        const points = [];
        for (let x = 0; x <= this.WIDTH; x += step) {
            points.push([x, this.HEIGHT - 60 - rand() * level.roughness]);
        }
        const pads = [];
        const count = level.pads;
        for (let i = 0; i < count; i++) {
            const span = this.WIDTH / count;
            const x1 = Math.round(i * span + 40 + rand() * (span - level.padWidth - 80));
            const y = this.HEIGHT - 70 - rand() * (level.roughness * 0.6);
            pads.push({ x1, x2: x1 + level.padWidth, y, mult: count - i === 1 ? 1 : (rand() < 0.5 ? 2 : 3) });
            points.forEach(p => { if (p[0] >= x1 - step && p[0] <= x1 + level.padWidth + step) p[1] = y; });
        }
        const ground = [];
        for (let x = 0; x <= this.WIDTH; x++) {
            const i = Math.min(Math.floor(x / step), points.length - 2);
            const t = (x - points[i][0]) / step;
            ground.push(points[i][1] + (points[i + 1][1] - points[i][1]) * t);
        }
        pads.forEach(p => { for (let x = p.x1; x <= p.x2; x++) ground[x] = p.y; });
        return {
            ground, pads, points,
            lander: { x: 80 + rand() * (this.WIDTH - 160), y: 50, vx: 20 + rand() * 20, vy: 0, angle: 0, fuel: level.fuel, maxFuel: level.fuel },
            gravity: level.gravity, time: 0, result: null, thrusting: false
        };
    },

    groundAt(state, x) {
        const i = Math.max(0, Math.min(this.WIDTH, Math.round(x)));
        return state.ground[i];
    },

    padUnder(state, x) {
        return state.pads.find(p => x - this.FOOT >= p.x1 && x + this.FOOT <= p.x2) || null;
    },

    // One tick with the control flags { left, right, thrust }
    step(state, input, dt = this.DT) {
        if (state.result) return state;
        const l = state.lander;
        if (input.left) l.angle -= this.ROTATE * dt;
        if (input.right) l.angle += this.ROTATE * dt;
        state.thrusting = !!(input.thrust && l.fuel > 0);
        if (state.thrusting) {
            l.vx += Math.sin(l.angle) * this.THRUST * dt;
            l.vy -= Math.cos(l.angle) * this.THRUST * dt;
            l.fuel = Math.max(0, l.fuel - this.BURN * dt);
        }
        l.vy += state.gravity * dt;
        l.x += l.vx * dt;
        l.y += l.vy * dt;
        if (l.x < 12) { l.x = 12; l.vx = 0; }
        if (l.x > this.WIDTH - 12) { l.x = this.WIDTH - 12; l.vx = 0; }
        if (l.y < 10) { l.y = 10; l.vy = Math.max(0, l.vy); }
        state.time += dt;

        const feetY = l.y + 12;
        const gl = this.groundAt(state, l.x - this.FOOT);
        const gr = this.groundAt(state, l.x + this.FOOT);
        if (feetY >= Math.min(gl, gr)) {
            const pad = this.padUnder(state, l.x);
            const gentle = Math.abs(l.vy) <= this.MAX_VY && Math.abs(l.vx) <= this.MAX_VX && Math.abs(l.angle) <= this.MAX_TILT;
            state.result = pad && gentle ? { type: 'landed', pad } : { type: 'crashed' };
            l.y = Math.min(gl, gr) - 12;
        }
        return state;
    }
};
