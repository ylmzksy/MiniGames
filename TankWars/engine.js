/**
 * Tank Wars. Two tanks on hilly ground fire shells at each other, choosing an
 * angle and a power. Gravity and wind bend the shot; a shell digs a crater
 * where it lands and damages tanks nearby. Tanks sink when the ground under
 * them is blown away. A tank with no hit points left is destroyed.
 * The terrain is a surface height per column; y points down.
 */
const TankEngine = {
    WIDTH: 640,
    HEIGHT: 360,
    GRAVITY: 220,
    POWER_SCALE: 3.4,
    CRATER: 26,
    BLAST: 42,          // damage radius
    MAX_DAMAGE: 45,
    HP: 100,
    DT: 1 / 90,

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

    // Rolling hills from a few random sine waves, kept inside the lower part of the screen
    create(level) {
        const rand = this.rng(level.seed);
        const waves = Array.from({ length: 4 }, (_, i) => ({ amp: level.hills * (0.6 - i * 0.12) * (0.6 + rand() * 0.8), freq: (1 + i) * (0.8 + rand() * 0.6), phase: rand() * Math.PI * 2 }));
        const ground = [];
        for (let x = 0; x <= this.WIDTH; x++) {
            let y = this.HEIGHT - level.base;
            waves.forEach(w => { y -= w.amp * Math.sin((x / this.WIDTH) * Math.PI * 2 * w.freq + w.phase); });
            ground.push(Math.max(60, Math.min(this.HEIGHT - 20, y)));
        }
        const tanks = [
            { x: Math.round(60 + rand() * 60), hp: this.HP },
            { x: Math.round(this.WIDTH - 60 - rand() * 60), hp: this.HP }
        ];
        const world = { ground, tanks, wind: Math.round((rand() * 2 - 1) * level.wind), rand };
        this.settle(world);
        return world;
    },

    settle(world) {
        world.tanks.forEach(t => { t.y = world.ground[Math.round(t.x)]; });
    },

    simulate(world, shooter, angle, power) {
        const dir = shooter === 0 ? 1 : -1;
        const t = world.tanks[shooter];
        const rad = (angle * Math.PI) / 180;
        let x = t.x + dir * Math.cos(rad) * 18;
        let y = t.y - 8 - Math.sin(rad) * 18;
        let vx = dir * Math.cos(rad) * power * this.POWER_SCALE;
        let vy = -Math.sin(rad) * power * this.POWER_SCALE;
        const path = [[x, y]];
        for (let step = 0; step < 5000; step++) {
            vx += world.wind * 2.5 * this.DT;
            vy += this.GRAVITY * this.DT;
            x += vx * this.DT;
            y += vy * this.DT;
            path.push([x, y]);
            if (x < -40 || x > this.WIDTH + 40) return { path, result: 'miss' };
            if (y > this.HEIGHT + 40) return { path, result: 'miss' };
            for (let i = 0; i < 2; i++) {
                const tk = world.tanks[i];
                if ((i !== shooter || step > 20) && Math.abs(x - tk.x) <= 14 && y >= tk.y - 14 && y <= tk.y + 2) return { path, result: 'hit', x, y };
            }
            if (x >= 0 && x <= this.WIDTH && y >= world.ground[Math.round(x)]) return { path, result: 'ground', x, y };
        }
        return { path, result: 'miss' };
    },

    // Digs a round crater and applies splash damage; returns the damage dealt to each tank
    impact(world, x, y) {
        const r = this.CRATER;
        for (let dx = -r; dx <= r; dx++) {
            const cx = Math.round(x + dx);
            if (cx < 0 || cx > this.WIDTH) continue;
            const depth = Math.sqrt(r * r - dx * dx);
            world.ground[cx] = Math.max(world.ground[cx], Math.min(this.HEIGHT - 10, y + depth));
        }
        const damage = world.tanks.map(t => {
            const d = Math.hypot(t.x - x, (t.y - 7) - y);
            return d > this.BLAST ? 0 : Math.round(this.MAX_DAMAGE * (1 - d / this.BLAST) + 5);
        });
        world.tanks.forEach((t, i) => { t.hp = Math.max(0, t.hp - damage[i]); });
        this.settle(world);
        return damage;
    },

    // Searches for the shot landing closest to the other tank
    findShot(world, shooter) {
        const target = world.tanks[1 - shooter];
        let best = null;
        for (let angle = 15; angle <= 85; angle += 2) {
            for (let power = 10; power <= 100; power += 2) {
                const sim = this.simulate(world, shooter, angle, power);
                if (sim.result === 'miss') continue;
                const d = Math.hypot(sim.x - target.x, sim.y - target.y);
                if (!best || d < best.d) best = { angle, power, d };
                if (d < 4) return best;
            }
        }
        return best || { angle: 45, power: 50, d: Infinity };
    },

    getAiShot(world, shooter, difficulty) {
        const shot = this.findShot(world, shooter);
        const wobble = difficulty === 'master' ? 1.5 : 8;
        const jitter = () => (Math.random() * 2 - 1) * wobble;
        return { angle: Math.max(5, Math.min(88, shot.angle + jitter())), power: Math.max(5, Math.min(100, shot.power + jitter())) };
    }
};
