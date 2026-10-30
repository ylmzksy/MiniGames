/**
 * Gorillas. Two gorillas on a city skyline throw bananas at each other.
 * A throw is an angle (degrees above horizontal) and a speed; gravity pulls
 * the banana down and wind pushes it sideways. Hitting a building blasts a
 * crater; hitting a gorilla ends the round.
 * World units are pixels on a WIDTH x HEIGHT canvas, y pointing down.
 */
const GorillasEngine = {
    WIDTH: 640,
    HEIGHT: 400,
    GRAVITY: 240,       // px/s²
    SPEED_SCALE: 3.2,   // px/s per speed unit
    CRATER: 22,
    GORILLA: { w: 28, h: 30 },
    DT: 1 / 90,

    // Deterministic random numbers so a level always builds the same city
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
        const count = level.buildings;
        const buildings = [];
        let x = 0;
        const unit = this.WIDTH / count;
        for (let i = 0; i < count; i++) {
            const w = Math.round(unit * (0.85 + rand() * 0.3));
            const width = i === count - 1 ? this.WIDTH - x : Math.min(w, this.WIDTH - x);
            const h = Math.round(level.minHeight + rand() * (level.maxHeight - level.minHeight));
            buildings.push({ x, width, height: h, color: ['#8a6d4b', '#6b7a8f', '#9c8f7a', '#7d6b8a'][Math.floor(rand() * 4)] });
            x += width;
        }
        const stand = i => ({ x: buildings[i].x + buildings[i].width / 2, y: this.HEIGHT - buildings[i].height });
        const left = 1 + Math.floor(rand() * 2);
        const right = count - 2 - Math.floor(rand() * 2);
        const wind = Math.round((rand() * 2 - 1) * level.wind);
        return { buildings, craters: [], gorillas: [stand(left), stand(right)], wind, rand };
    },

    // True when the point is inside building material that has not been blasted away
    solid(world, x, y) {
        if (y >= this.HEIGHT) return true;
        const b = world.buildings.find(b => x >= b.x && x < b.x + b.width);
        if (!b || y < this.HEIGHT - b.height) return false;
        return !world.craters.some(c => Math.hypot(c.x - x, c.y - y) < c.r);
    },

    hitsGorilla(world, i, x, y) {
        const g = world.gorillas[i];
        return Math.abs(x - g.x) <= this.GORILLA.w / 2 && y <= g.y && y >= g.y - this.GORILLA.h;
    },

    // Flies a banana thrown by gorilla `thrower`; returns the path and how it ended
    simulate(world, thrower, angle, speed) {
        const dir = thrower === 0 ? 1 : -1;
        const g = world.gorillas[thrower];
        const rad = (angle * Math.PI) / 180;
        let x = g.x + dir * this.GORILLA.w * 0.6;
        let y = g.y - this.GORILLA.h - 4;
        let vx = dir * Math.cos(rad) * speed * this.SPEED_SCALE;
        let vy = -Math.sin(rad) * speed * this.SPEED_SCALE;
        const path = [[x, y]];
        for (let step = 0; step < 4000; step++) {
            vx += world.wind * 3 * this.DT;
            vy += this.GRAVITY * this.DT;
            x += vx * this.DT;
            y += vy * this.DT;
            path.push([x, y]);
            if (x < -50 || x > this.WIDTH + 50 || y > this.HEIGHT + 50) return { path, result: 'miss' };
            if (y < -2000) return { path, result: 'miss' };
            for (let i = 0; i < 2; i++) {
                if ((i !== thrower || step > 25) && this.hitsGorilla(world, i, x, y)) return { path, result: 'gorilla', target: i, x, y };
            }
            if (this.solid(world, x, y)) return { path, result: 'building', x, y };
        }
        return { path, result: 'miss' };
    },

    blast(world, x, y) {
        world.craters.push({ x, y, r: this.CRATER });
    },

    // Searches angles and speeds for a throw that hits the other gorilla
    findShot(world, thrower) {
        const target = 1 - thrower;
        let best = null;
        for (let angle = 20; angle <= 80; angle += 2) {
            for (let speed = 15; speed <= 110; speed += 2) {
                const sim = this.simulate(world, thrower, angle, speed);
                if (sim.result === 'gorilla' && sim.target === target) return { angle, speed };
                if (sim.result === 'building') {
                    const d = Math.hypot(sim.x - world.gorillas[target].x, sim.y - world.gorillas[target].y);
                    if (!best || d < best.d) best = { angle, speed, d };
                }
            }
        }
        return best ? { angle: best.angle, speed: best.speed } : { angle: 45, speed: 60 };
    },

    // Novice aims roughly, master almost exactly
    getAiThrow(world, thrower, difficulty) {
        const shot = this.findShot(world, thrower);
        const wobble = difficulty === 'master' ? 1.5 : 7;
        const jitter = () => (Math.random() * 2 - 1) * wobble;
        return { angle: Math.max(10, Math.min(85, shot.angle + jitter())), speed: Math.max(10, Math.min(120, shot.speed + jitter())) };
    }
};
