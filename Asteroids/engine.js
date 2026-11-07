/**
 * Asteroids. A ship with inertia on a wrapping screen; rotate, thrust and
 * shoot. Shot asteroids split (big → 2 medium → 2 small → gone). Touching an
 * asteroid costs a life; the level is cleared when no asteroid is left.
 */
const AsteroidsEngine = {
    WIDTH: 640,
    HEIGHT: 420,
    ROTATE: 3.6,
    THRUST: 220,
    DRAG: 0.35,
    BULLET_SPEED: 320,
    BULLET_LIFE: 1.1,
    MAX_BULLETS: 4,
    FIRE_COOLDOWN: 0.18,
    RADIUS: { 3: 40, 2: 24, 1: 12 },
    SHIP_RADIUS: 12,
    INVULNERABLE: 2.2,
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

    create(level) {
        const rand = this.rng(level.seed);
        const state = { rand, speed: level.speed, asteroids: [], bullets: [], lives: 3, score: 0, result: null,
            ship: { x: this.WIDTH / 2, y: this.HEIGHT / 2, vx: 0, vy: 0, angle: -Math.PI / 2, cooldown: 0, invulnerable: this.INVULNERABLE, thrusting: false } };
        for (let i = 0; i < level.asteroids; i++) {
            // start away from the ship
            const angle = rand() * Math.PI * 2;
            const dist = 150 + rand() * 120;
            state.asteroids.push(this.makeAsteroid(state, this.WIDTH / 2 + Math.cos(angle) * dist, this.HEIGHT / 2 + Math.sin(angle) * dist, 3));
        }
        return state;
    },

    makeAsteroid(state, x, y, size) {
        const rand = state.rand;
        const speed = state.speed * (1 + (3 - size) * 0.45) * (0.7 + rand() * 0.6);
        const dir = rand() * Math.PI * 2;
        const shape = Array.from({ length: 10 }, () => 0.7 + rand() * 0.45);
        return { x: this.wrapX(x), y: this.wrapY(y), vx: Math.cos(dir) * speed, vy: Math.sin(dir) * speed, size, r: this.RADIUS[size], shape, spin: (rand() - 0.5) * 2, rot: 0 };
    },

    wrapX(x) { return ((x % this.WIDTH) + this.WIDTH) % this.WIDTH; },
    wrapY(y) { return ((y % this.HEIGHT) + this.HEIGHT) % this.HEIGHT; },

    // Shortest distance on the wrapping screen
    dist(a, b) {
        let dx = Math.abs(a.x - b.x);
        let dy = Math.abs(a.y - b.y);
        dx = Math.min(dx, this.WIDTH - dx);
        dy = Math.min(dy, this.HEIGHT - dy);
        return Math.hypot(dx, dy);
    },

    fire(state) {
        const s = state.ship;
        if (s.cooldown > 0 || state.bullets.length >= this.MAX_BULLETS) return false;
        state.bullets.push({ x: s.x + Math.cos(s.angle) * 14, y: s.y + Math.sin(s.angle) * 14,
            vx: s.vx + Math.cos(s.angle) * this.BULLET_SPEED, vy: s.vy + Math.sin(s.angle) * this.BULLET_SPEED, life: this.BULLET_LIFE });
        s.cooldown = this.FIRE_COOLDOWN;
        return true;
    },

    step(state, input, dt = this.DT) {
        if (state.result) return state;
        const s = state.ship;
        if (input.left) s.angle -= this.ROTATE * dt;
        if (input.right) s.angle += this.ROTATE * dt;
        s.thrusting = !!input.thrust;
        if (s.thrusting) { s.vx += Math.cos(s.angle) * this.THRUST * dt; s.vy += Math.sin(s.angle) * this.THRUST * dt; }
        s.vx -= s.vx * this.DRAG * dt;
        s.vy -= s.vy * this.DRAG * dt;
        s.x = this.wrapX(s.x + s.vx * dt);
        s.y = this.wrapY(s.y + s.vy * dt);
        s.cooldown = Math.max(0, s.cooldown - dt);
        s.invulnerable = Math.max(0, s.invulnerable - dt);
        if (input.fire) this.fire(state);

        state.bullets.forEach(b => { b.x = this.wrapX(b.x + b.vx * dt); b.y = this.wrapY(b.y + b.vy * dt); b.life -= dt; });
        state.bullets = state.bullets.filter(b => b.life > 0);
        state.asteroids.forEach(a => { a.x = this.wrapX(a.x + a.vx * dt); a.y = this.wrapY(a.y + a.vy * dt); a.rot += a.spin * dt; });

        // bullets hit asteroids
        const spawned = [];
        state.asteroids = state.asteroids.filter(a => {
            const hit = state.bullets.findIndex(b => this.dist(a, b) < a.r);
            if (hit < 0) return true;
            state.bullets.splice(hit, 1);
            state.score += a.size === 3 ? 20 : a.size === 2 ? 50 : 100;
            if (a.size > 1) spawned.push(this.makeAsteroid(state, a.x, a.y, a.size - 1), this.makeAsteroid(state, a.x, a.y, a.size - 1));
            return false;
        });
        state.asteroids.push(...spawned);

        // asteroids hit the ship
        if (s.invulnerable <= 0 && state.asteroids.some(a => this.dist(a, s) < a.r + this.SHIP_RADIUS * 0.8)) {
            state.lives--;
            if (state.lives <= 0) { state.result = 'lost'; return state; }
            Object.assign(s, { x: this.WIDTH / 2, y: this.HEIGHT / 2, vx: 0, vy: 0, angle: -Math.PI / 2, invulnerable: this.INVULNERABLE });
        }
        if (!state.asteroids.length) state.result = 'won';
        return state;
    }
};
