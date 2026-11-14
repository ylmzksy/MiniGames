/**
 * Mini Golf. A top-down course seen on a WIDTH x HEIGHT canvas (pixels, y down).
 * A level describes the course as polygons: the first one in `walls` is the
 * outline that keeps the ball in, the others are solid blocks inside it.
 * Round `bumpers` bounce the ball harder than walls. Rectangular zones change
 * how the ball rolls: `sand` slows it down, `slopes` push it in a direction and
 * `water` sends it back to where the stroke was played, at a one-stroke penalty.
 * The ball drops when it rolls over the hole slowly enough.
 */
const GolfEngine = {
    WIDTH: 400,
    HEIGHT: 560,
    BALL_R: 6,
    HOLE_R: 10,
    WALL_HALF: 3,          // half the drawn wall thickness
    MAX_SPEED: 820,        // px/s at full power
    DROP_SPEED: 220,       // the ball drops when slower than this over the hole
    WALL_BOUNCE: 0.72,
    BUMPER_BOUNCE: 1.05,
    GRASS: { decel: 140, damping: 0.6 },
    SAND: { decel: 650, damping: 2.6 },
    REST_SPEED: 8,
    REST_TIME: 0.35,       // seconds slower than REST_SPEED before the ball counts as stopped
    DT: 1 / 240,

    // Builds the collision data for a level once and keeps it on the level object
    course(level) {
        if (level._course) return level._course;
        const segments = [];
        level.walls.forEach(poly => {
            poly.forEach((a, i) => segments.push([a, poly[(i + 1) % poly.length]]));
        });
        level._course = {
            segments,
            bumpers: (level.bumpers || []).map(([x, y, r]) => ({ x, y, r })),
            sand: level.sand || [],
            water: level.water || [],
            slopes: level.slopes || [],
            hole: { x: level.hole[0], y: level.hole[1] },
            tee: { x: level.tee[0], y: level.tee[1] }
        };
        return level._course;
    },

    create(level) {
        const { tee } = this.course(level);
        return {
            ball: { x: tee.x, y: tee.y, vx: 0, vy: 0 },
            shotFrom: { x: tee.x, y: tee.y },
            strokes: 0,
            moving: false,
            sunk: false,
            restTime: 0,
            ballScale: 1     // shrinks while the ball drops into the hole
        };
    },

    inRect(r, x, y) {
        return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
    },

    // angle in radians (0 = right, clockwise because y points down), power 0..1
    shoot(state, angle, power) {
        if (state.moving || state.sunk) return false;
        const p = Math.max(0, Math.min(1, power));
        state.shotFrom = { x: state.ball.x, y: state.ball.y };
        state.ball.vx = Math.cos(angle) * p * this.MAX_SPEED;
        state.ball.vy = Math.sin(angle) * p * this.MAX_SPEED;
        state.strokes++;
        state.moving = true;
        state.restTime = 0;
        return true;
    },

    // Advances the ball by one fixed step; returns 'sunk', 'water', 'rest' or null
    step(state, level) {
        if (!state.moving) return null;
        const c = this.course(level);
        const b = state.ball;
        const dt = this.DT;

        // Slopes push, sand and grass slow down
        c.slopes.forEach(s => {
            if (this.inRect(s, b.x, b.y)) { b.vx += s.ax * dt; b.vy += s.ay * dt; }
        });
        const ground = c.sand.some(s => this.inRect(s, b.x, b.y)) ? this.SAND : this.GRASS;
        let speed = Math.hypot(b.vx, b.vy);
        if (speed > 0) {
            const slowed = Math.max(0, speed - (ground.decel + ground.damping * speed) * dt);
            b.vx *= slowed / speed;
            b.vy *= slowed / speed;
        }

        // A ball rolling over the hole is pulled in; slow enough and it drops
        const hx = c.hole.x - b.x;
        const hy = c.hole.y - b.y;
        const hd = Math.hypot(hx, hy);
        if (hd < this.HOLE_R) {
            speed = Math.hypot(b.vx, b.vy);
            if (speed < this.DROP_SPEED) {
                state.sunk = true;
                state.moving = false;
                b.vx = 0; b.vy = 0;
                return 'sunk';
            }
            const pull = 1400 * dt;
            b.vx += (hx / (hd || 1)) * pull;
            b.vy += (hy / (hd || 1)) * pull;
        }

        b.x += b.vx * dt;
        b.y += b.vy * dt;

        this.collide(c, b);

        if (c.water.some(w => this.inRect(w, b.x, b.y))) {
            state.strokes++;
            b.x = state.shotFrom.x;
            b.y = state.shotFrom.y;
            b.vx = 0; b.vy = 0;
            state.moving = false;
            return 'water';
        }

        if (Math.hypot(b.vx, b.vy) < this.REST_SPEED) {
            state.restTime += dt;
            if (state.restTime >= this.REST_TIME) {
                b.vx = 0; b.vy = 0;
                state.moving = false;
                return 'rest';
            }
        } else {
            state.restTime = 0;
        }
        return null;
    },

    collide(c, b) {
        const reach = this.BALL_R + this.WALL_HALF;
        c.segments.forEach(([[ax, ay], [bx, by]]) => {
            const ex = bx - ax;
            const ey = by - ay;
            const len2 = ex * ex + ey * ey;
            const t = len2 ? Math.max(0, Math.min(1, ((b.x - ax) * ex + (b.y - ay) * ey) / len2)) : 0;
            const px = ax + ex * t;
            const py = ay + ey * t;
            this.bounce(b, px, py, reach, this.WALL_BOUNCE);
        });
        c.bumpers.forEach(bp => {
            const dx = b.x - bp.x;
            const dy = b.y - bp.y;
            const d = Math.hypot(dx, dy) || 1;
            // the closest point on the bumper's rim
            this.bounce(b, bp.x + (dx / d) * bp.r, bp.y + (dy / d) * bp.r, this.BALL_R, this.BUMPER_BOUNCE);
        });
    },

    // Pushes the ball out of contact with point (px, py) and reflects its velocity
    bounce(b, px, py, reach, restitution) {
        const dx = b.x - px;
        const dy = b.y - py;
        const d = Math.hypot(dx, dy);
        if (d >= reach || d === 0) return;
        const nx = dx / d;
        const ny = dy / d;
        b.x = px + nx * reach;
        b.y = py + ny * reach;
        const vn = b.vx * nx + b.vy * ny;
        if (vn < 0) {
            b.vx -= (1 + restitution) * vn * nx;
            b.vy -= (1 + restitution) * vn * ny;
        }
    },

    // Plays a whole stroke without animation (used to check that levels are playable)
    simulate(level, from, angle, power) {
        const state = this.create(level);
        state.ball.x = from.x;
        state.ball.y = from.y;
        this.shoot(state, angle, power);
        for (let i = 0; i < 240 * 20; i++) {
            const event = this.step(state, level);
            if (event) return { event, x: state.ball.x, y: state.ball.y };
        }
        return { event: 'rest', x: state.ball.x, y: state.ball.y };
    }
};
