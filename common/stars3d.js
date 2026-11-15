/**
 * Shared 3D star scenes (Star Cube, Star Dials): quaternion maths, random
 * stars in a cube, and drawing a cube of stars in perspective on a canvas.
 * Orientations are unit quaternions [w, x, y, z]; screen axes are x right,
 * y up and z towards the viewer.
 */
const StarMath = {
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

    identity() {
        return [1, 0, 0, 0];
    },

    axisAngle(axis, angle) {
        const s = Math.sin(angle / 2);
        return [Math.cos(angle / 2), axis[0] * s, axis[1] * s, axis[2] * s];
    },

    mul(a, b) {
        return [
            a[0] * b[0] - a[1] * b[1] - a[2] * b[2] - a[3] * b[3],
            a[0] * b[1] + a[1] * b[0] + a[2] * b[3] - a[3] * b[2],
            a[0] * b[2] - a[1] * b[3] + a[2] * b[0] + a[3] * b[1],
            a[0] * b[3] + a[1] * b[2] - a[2] * b[1] + a[3] * b[0]
        ];
    },

    normalize(q) {
        const n = Math.hypot(...q);
        return q.map(v => v / n);
    },

    // Rotates point p by q
    apply(q, p) {
        const [w, x, y, z] = q;
        const m = [
            1 - 2 * (y * y + z * z), 2 * (x * y - w * z), 2 * (x * z + w * y),
            2 * (x * y + w * z), 1 - 2 * (x * x + z * z), 2 * (y * z - w * x),
            2 * (x * z - w * y), 2 * (y * z + w * x), 1 - 2 * (x * x + y * y)
        ];
        return [
            m[0] * p[0] + m[1] * p[1] + m[2] * p[2],
            m[3] * p[0] + m[4] * p[1] + m[5] * p[2],
            m[6] * p[0] + m[7] * p[1] + m[8] * p[2]
        ];
    },

    // Angle in degrees between two orientations
    angle(a, b) {
        const dot = Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]);
        return (2 * Math.acos(Math.min(1, dot)) * 180) / Math.PI;
    },

    slerp(a, b, t) {
        let dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
        let end = b;
        if (dot < 0) { dot = -dot; end = b.map(v => -v); }
        if (dot > 0.9995) return this.normalize(a.map((v, i) => v + (end[i] - v) * t));
        const theta = Math.acos(dot);
        const s = Math.sin(theta);
        const wa = Math.sin((1 - t) * theta) / s;
        const wb = Math.sin(t * theta) / s;
        return a.map((v, i) => v * wa + end[i] * wb);
    },

    // A uniformly random orientation (Shoemake)
    randomOrientation(rand) {
        const u1 = rand();
        const u2 = rand() * 2 * Math.PI;
        const u3 = rand() * 2 * Math.PI;
        const a = Math.sqrt(1 - u1);
        const b = Math.sqrt(u1);
        return [a * Math.sin(u2), a * Math.cos(u2), b * Math.sin(u3), b * Math.cos(u3)];
    },

    // Key for an orientation made of quarter turns (its matrix entries are -1, 0 or 1)
    key(q) {
        return [[1, 0, 0], [0, 1, 0], [0, 0, 1]]
            .map(p => this.apply(q, p).map(v => Math.round(v)).join(','))
            .join('|');
    }
};

const StarScene = {
    CAMERA: 4.2,
    // Fraction of the canvas per cube unit at the centre; small enough that a corner never leaves the canvas
    SCALE: 0.24,
    PALETTE: ['#ff5d5d', '#ffd23f', '#4dd77a', '#4fb3ff', '#c77dff', '#ff9a3c'],
    EDGES: (() => {
        const corners = [];
        for (let i = 0; i < 8; i++) corners.push([i & 1 ? 1 : -1, i & 2 ? 1 : -1, i & 4 ? 1 : -1]);
        const edges = [];
        for (let a = 0; a < 8; a++) {
            for (let b = a + 1; b < 8; b++) {
                if (corners[a].filter((v, k) => v !== corners[b][k]).length === 1) edges.push([corners[a], corners[b]]);
            }
        }
        return edges;
    })(),

    // Random stars inside the cube, kept apart so they don't overlap on screen.
    // level: { stars, colored }; rand: a StarMath.rng
    makeStars(level, rand) {
        const stars = [];
        let tries = 0;
        while (stars.length < level.stars && tries < 5000) {
            tries++;
            const p = [0, 0, 0].map(() => (rand() * 2 - 1) * 0.82);
            if (stars.some(s => Math.hypot(s.p[0] - p[0], s.p[1] - p[1], s.p[2] - p[2]) < 0.5)) continue;
            const color = level.colored ? this.PALETTE[stars.length % this.PALETTE.length] : '#fff8e7';
            stars.push({ p, color });
        }
        return stars;
    },

    // Matches the canvas resolution to its displayed size
    resize(canvas) {
        const ratio = window.devicePixelRatio || 1;
        const size = canvas.clientWidth;
        canvas.width = Math.round(size * ratio);
        canvas.height = Math.round(size * ratio);
    },

    project(p, size) {
        const scale = (size * this.SCALE * this.CAMERA) / (this.CAMERA - p[2]);
        return { x: size / 2 + p[0] * scale, y: size / 2 - p[1] * scale, z: p[2], scale };
    },

    line(ctx, a, b) {
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
    },

    /**
     * Draws scene { stars, lines } turned by `orientation`. rods: optional axes
     * [{ dir, color }] in screen space, drawn through the centre; the half
     * pointing away is drawn behind the stars, the near half in front.
     */
    draw(canvas, scene, orientation, rods = []) {
        const ctx = canvas.getContext('2d');
        const size = canvas.width;
        ctx.clearRect(0, 0, size, size);
        const centre = this.project([0, 0, 0], size);
        const rodEnds = rods.map(rod => {
            const tip = this.project(rod.dir.map(v => v * 1.55), size);
            const tail = this.project(rod.dir.map(v => v * -1.55), size);
            return { ...rod, front: tip.z >= tail.z ? tip : tail, back: tip.z >= tail.z ? tail : tip };
        });
        const drawRods = (half) => rodEnds.forEach(rod => {
            ctx.strokeStyle = rod.color;
            ctx.globalAlpha = half === 'back' ? 0.45 : 0.9;
            ctx.lineWidth = Math.max(2, size / 120);
            ctx.lineCap = 'round';
            this.line(ctx, centre, rod[half]);
            ctx.fillStyle = rod.color;
            ctx.beginPath();
            ctx.arc(rod[half].x, rod[half].y, Math.max(3, size / 70), 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
        });

        drawRods('back');

        // Cube edges: the nearer, the brighter
        ctx.lineWidth = Math.max(1, size / 260);
        this.EDGES.forEach(([a, b]) => {
            const pa = this.project(StarMath.apply(orientation, a), size);
            const pb = this.project(StarMath.apply(orientation, b), size);
            const depth = (pa.z + pb.z) / 2;
            ctx.strokeStyle = `rgba(150, 180, 255, ${0.18 + 0.22 * (depth + 1.5) / 3})`;
            this.line(ctx, pa, pb);
        });

        const points = scene.stars.map(star => ({ ...this.project(StarMath.apply(orientation, star.p), size), color: star.color }));

        // Constellation lines
        ctx.lineWidth = Math.max(1, size / 220);
        (scene.lines || []).forEach(([i, j]) => {
            const a = points[i];
            const b = points[j];
            const grad = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
            grad.addColorStop(0, `rgba(255, 240, 200, ${0.25 + 0.2 * a.z})`);
            grad.addColorStop(1, `rgba(255, 240, 200, ${0.25 + 0.2 * b.z})`);
            ctx.strokeStyle = grad;
            this.line(ctx, a, b);
        });

        // Stars, far ones first; size and brightness show depth
        [...points].sort((a, b) => a.z - b.z).forEach(pt => {
            const r = (size / 48) * (pt.scale / (size * this.SCALE)) * (0.75 + 0.25 * pt.z);
            const glow = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, r * 3);
            glow.addColorStop(0, pt.color);
            glow.addColorStop(0.3, pt.color + '88');
            glow.addColorStop(1, pt.color + '00');
            ctx.globalAlpha = 0.55 + 0.45 * (pt.z + 1) / 2;
            ctx.fillStyle = glow;
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, r * 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, r * 0.55, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
        });

        drawRods('front');
    }
};
