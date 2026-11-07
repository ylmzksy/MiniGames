/**
 * Space Invaders. A formation of aliens marches sideways, drops a row at the
 * edges and speeds up as it thins out. The player slides along the bottom
 * and fires one shot at a time; aliens shoot back. Shields erode under fire.
 * Clear the formation to win; lose when out of lives or when the aliens
 * reach the ground.
 */
const InvadersEngine = {
    WIDTH: 640,
    HEIGHT: 420,
    ALIEN_W: 32,
    ALIEN_H: 22,
    GAP_X: 14,
    GAP_Y: 14,
    PLAYER_Y: 385,
    PLAYER_SPEED: 240,
    BULLET_SPEED: 420,
    ALIEN_BULLET_SPEED: 170,
    DROP: 18,
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
        const aliens = [];
        for (let r = 0; r < level.rows; r++) {
            for (let c = 0; c < level.cols; c++) aliens.push({ r, c, alive: true, kind: r === 0 ? 2 : r < 3 ? 1 : 0 });
        }
        const shields = [];
        const count = 4;
        for (let i = 0; i < count; i++) {
            const x0 = (this.WIDTH / count) * i + this.WIDTH / count / 2 - 28;
            const cells = [];
            for (let y = 0; y < 3; y++) for (let x = 0; x < 7; x++) if (!(y === 2 && (x === 3))) cells.push({ x: x0 + x * 8, y: 320 + y * 8, w: 8, h: 8 });
            shields.push(...cells);
        }
        return {
            rand: this.rng(level.seed), aliens, rows: level.rows, cols: level.cols,
            ox: 40, oy: 50, dir: 1, moveTimer: 0, baseInterval: level.interval, fireRate: level.fireRate,
            player: { x: this.WIDTH / 2, cooldown: 0 }, bullet: null, alienBullets: [], shields,
            lives: 3, score: 0, result: null, hitFlash: 0
        };
    },

    alienRect(state, a) {
        return { x: state.ox + a.c * (this.ALIEN_W + this.GAP_X), y: state.oy + a.r * (this.ALIEN_H + this.GAP_Y), w: this.ALIEN_W, h: this.ALIEN_H };
    },

    alive(state) {
        return state.aliens.filter(a => a.alive);
    },

    hits(point, rect) {
        return point.x >= rect.x && point.x <= rect.x + rect.w && point.y >= rect.y && point.y <= rect.y + rect.h;
    },

    fire(state) {
        if (state.bullet || state.player.cooldown > 0) return false;
        state.bullet = { x: state.player.x, y: this.PLAYER_Y - 14 };
        state.player.cooldown = 0.25;
        return true;
    },

    step(state, input, dt = this.DT) {
        if (state.result) return state;
        const p = state.player;
        if (input.left) p.x -= this.PLAYER_SPEED * dt;
        if (input.right) p.x += this.PLAYER_SPEED * dt;
        p.x = Math.max(16, Math.min(this.WIDTH - 16, p.x));
        p.cooldown = Math.max(0, p.cooldown - dt);
        if (input.fire) this.fire(state);
        state.hitFlash = Math.max(0, state.hitFlash - dt);

        // formation marching: faster with fewer aliens
        const alive = this.alive(state);
        const interval = state.baseInterval * (0.25 + 0.75 * alive.length / state.aliens.length);
        state.moveTimer += dt;
        if (state.moveTimer >= interval) {
            state.moveTimer = 0;
            const rects = alive.map(a => this.alienRect(state, a));
            const minX = Math.min(...rects.map(r => r.x));
            const maxX = Math.max(...rects.map(r => r.x + r.w));
            if ((state.dir > 0 && maxX + 12 >= this.WIDTH) || (state.dir < 0 && minX - 12 <= 0)) {
                state.dir *= -1;
                state.oy += this.DROP;
            } else {
                state.ox += state.dir * 12;
            }
        }

        // aliens shoot from the bottom of their columns
        if (alive.length && state.rand() < state.fireRate * dt) {
            const cols = {};
            alive.forEach(a => { if (!cols[a.c] || cols[a.c].r < a.r) cols[a.c] = a; });
            const shooters = Object.values(cols);
            const a = shooters[Math.floor(state.rand() * shooters.length)];
            const r = this.alienRect(state, a);
            state.alienBullets.push({ x: r.x + r.w / 2, y: r.y + r.h });
        }

        // player bullet, moved in small sub-steps so it cannot skip over a shield cell
        for (let sub = 0; sub < 3 && state.bullet; sub++) {
            const b = state.bullet;
            b.y -= (this.BULLET_SPEED * dt) / 3;
            const hit = alive.find(a => a.alive && this.hits(b, this.alienRect(state, a)));
            if (hit) { hit.alive = false; state.score += (hit.kind + 1) * 10; state.bullet = null; break; }
            const si = state.shields.findIndex(s => this.hits(b, s));
            if (si >= 0) { state.shields.splice(si, 1); state.bullet = null; break; }
            if (b.y < 0) state.bullet = null;
        }

        // alien bullets
        state.alienBullets.forEach(b => { b.y += this.ALIEN_BULLET_SPEED * dt; });
        state.alienBullets = state.alienBullets.filter(b => {
            const si = state.shields.findIndex(s => this.hits(b, s));
            if (si >= 0) { state.shields.splice(si, 1); return false; }
            if (Math.abs(b.x - p.x) < 16 && b.y >= this.PLAYER_Y - 10 && b.y <= this.PLAYER_Y + 10) {
                state.lives--;
                state.hitFlash = 0.6;
                state.alienBullets = [];
                if (state.lives <= 0) state.result = 'lost';
                return false;
            }
            return b.y < this.HEIGHT;
        });
        if (state.result) return state;

        // aliens erase shields they touch, and landing ends the game
        const lowest = Math.max(...alive.map(a => this.alienRect(state, a).y + this.ALIEN_H), 0);
        state.shields = state.shields.filter(s => s.y > lowest);
        if (lowest >= this.PLAYER_Y - 10) state.result = 'lost';
        if (!alive.length) state.result = 'won';
        return state;
    }
};
