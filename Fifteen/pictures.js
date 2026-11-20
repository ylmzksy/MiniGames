/**
 * Original pictures for the picture levels, drawn on a canvas at load time
 * (no image files). Pictures.url(id) returns a cached data URL of a square image.
 */
const Pictures = {
    SIZE: 480,
    cache: {},

    url(id) {
        if (!this.cache[id]) {
            const canvas = document.createElement('canvas');
            canvas.width = canvas.height = this.SIZE;
            const ctx = canvas.getContext('2d');
            (this[id] || this.sunrise).call(this, ctx, this.SIZE, this.random(id.length * 7919 + 17));
            this.cache[id] = canvas.toDataURL('image/png');
        }
        return this.cache[id];
    },

    // Small seeded generator so every picture is the same on every visit
    random(seed) {
        let s = seed >>> 0;
        return () => {
            s = (s * 1664525 + 1013904223) >>> 0;
            return s / 4294967296;
        };
    },

    gradient(ctx, x0, y0, x1, y1, stops) {
        const g = ctx.createLinearGradient(x0, y0, x1, y1);
        stops.forEach(([at, color]) => g.addColorStop(at, color));
        return g;
    },

    hill(ctx, S, baseY, amp, waves, phase, color) {
        ctx.beginPath();
        ctx.moveTo(0, S);
        for (let x = 0; x <= S; x += 4) {
            ctx.lineTo(x, baseY + Math.sin(x / S * Math.PI * waves + phase) * amp);
        }
        ctx.lineTo(S, S);
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
    },

    // Layered hills under a striped sun
    sunrise(ctx, S, rnd) {
        ctx.fillStyle = this.gradient(ctx, 0, 0, 0, S, [[0, '#2b1f5c'], [0.45, '#c2457a'], [0.75, '#f7a547'], [1, '#ffd98a']]);
        ctx.fillRect(0, 0, S, S);
        for (let i = 0; i < 40; i++) {
            ctx.fillStyle = `rgba(255,255,255,${0.3 + rnd() * 0.5})`;
            ctx.beginPath();
            ctx.arc(rnd() * S, rnd() * S * 0.3, 1 + rnd() * 1.6, 0, Math.PI * 2);
            ctx.fill();
        }
        const cx = S * 0.58, cy = S * 0.56, r = S * 0.24;
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.clip();
        ctx.fillStyle = this.gradient(ctx, 0, cy - r, 0, cy + r, [[0, '#fff3b0'], [1, '#ff8a3d']]);
        ctx.fillRect(cx - r, cy - r, 2 * r, 2 * r);
        ctx.fillStyle = '#c2457a';
        for (let k = 0; k < 6; k++) ctx.fillRect(cx - r, cy + k * r * 0.17, 2 * r, r * 0.04 + k * 2);
        ctx.restore();
        ctx.strokeStyle = 'rgba(43,31,92,0.55)';
        ctx.lineWidth = 3;
        [[0.2, 0.22], [0.26, 0.19], [0.31, 0.24]].forEach(([x, y]) => {
            ctx.beginPath();
            ctx.moveTo(S * x - 10, S * y);
            ctx.quadraticCurveTo(S * x - 5, S * y - 7, S * x, S * y);
            ctx.quadraticCurveTo(S * x + 5, S * y - 7, S * x + 10, S * y);
            ctx.stroke();
        });
        this.hill(ctx, S, S * 0.66, S * 0.05, 1.6, 0.6, '#7a3b8f');
        this.hill(ctx, S, S * 0.76, S * 0.05, 2.4, 2.1, '#4c2a78');
        this.hill(ctx, S, S * 0.88, S * 0.04, 1.2, 4.0, '#24184a');
        ctx.fillStyle = '#24184a';
        [[0.12, 0.84], [0.18, 0.86], [0.83, 0.85]].forEach(([x, y], i) => {
            const h = S * (0.12 + i * 0.02);
            ctx.beginPath();
            ctx.moveTo(S * x, S * y - h);
            ctx.lineTo(S * x - h * 0.28, S * y);
            ctx.lineTo(S * x + h * 0.28, S * y);
            ctx.closePath();
            ctx.fill();
        });
    },

    // A patchwork of triangles with a big diamond on top
    quilt(ctx, S, rnd) {
        const colors = ['#e4572e', '#f3a712', '#29335c', '#669bbc', '#a8c686', '#f0e6d2'];
        const k = 8, c = S / k;
        for (let y = 0; y < k; y++) {
            for (let x = 0; x < k; x++) {
                const a = colors[Math.floor(rnd() * colors.length)];
                let b = colors[Math.floor(rnd() * colors.length)];
                if (b === a) b = colors[(colors.indexOf(a) + 2) % colors.length];
                ctx.fillStyle = a;
                ctx.fillRect(x * c, y * c, c, c);
                ctx.fillStyle = b;
                ctx.beginPath();
                if ((x + y) % 2) {
                    ctx.moveTo(x * c, y * c); ctx.lineTo(x * c + c, y * c); ctx.lineTo(x * c, y * c + c);
                } else {
                    ctx.moveTo(x * c + c, y * c); ctx.lineTo(x * c + c, y * c + c); ctx.lineTo(x * c, y * c + c);
                }
                ctx.fill();
            }
        }
        ctx.lineWidth = 10;
        ctx.strokeStyle = '#f0e6d2';
        ctx.fillStyle = 'rgba(41,51,92,0.88)';
        ctx.beginPath();
        ctx.moveTo(S / 2, S * 0.12); ctx.lineTo(S * 0.88, S / 2); ctx.lineTo(S / 2, S * 0.88); ctx.lineTo(S * 0.12, S / 2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#f3a712';
        ctx.beginPath();
        for (let i = 0; i < 16; i++) {
            const ang = i * Math.PI / 8 - Math.PI / 2;
            const rr = i % 2 ? S * 0.09 : S * 0.2;
            ctx.lineTo(S / 2 + Math.cos(ang) * rr, S / 2 + Math.sin(ang) * rr);
        }
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#e4572e';
        ctx.beginPath();
        ctx.arc(S / 2, S / 2, S * 0.05, 0, Math.PI * 2);
        ctx.fill();
    },

    // A ringed planet with moons on their orbits
    orbit(ctx, S, rnd) {
        ctx.fillStyle = this.gradient(ctx, 0, 0, S, S, [[0, '#0d1b3e'], [1, '#1d0f33']]);
        ctx.fillRect(0, 0, S, S);
        for (let i = 0; i < 90; i++) {
            ctx.fillStyle = `rgba(255,255,255,${0.25 + rnd() * 0.6})`;
            ctx.fillRect(rnd() * S, rnd() * S, 1.5 + rnd() * 1.5, 1.5 + rnd() * 1.5);
        }
        const cx = S * 0.45, cy = S * 0.52;
        ctx.lineWidth = 2;
        [0.2, 0.3, 0.4, 0.52].forEach((r, i) => {
            ctx.strokeStyle = ['#3fa7d6', '#59cd90', '#fac05e', '#ee6352'][i];
            ctx.setLineDash(i % 2 ? [8, 8] : []);
            ctx.beginPath();
            ctx.ellipse(cx, cy, S * r, S * r * 0.82, -0.3, 0, Math.PI * 2);
            ctx.stroke();
        });
        ctx.setLineDash([]);
        [[0.2, 1.0, '#3fa7d6', 0.035], [0.3, 4.0, '#59cd90', 0.045], [0.4, 2.3, '#fac05e', 0.04], [0.52, 5.4, '#ee6352', 0.055]].forEach(([r, ang, color, size]) => {
            const x = cx + Math.cos(ang) * S * r, y = cy + Math.sin(ang) * S * r * 0.82;
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(x, y, S * size, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.fillStyle = this.gradient(ctx, cx - S * 0.1, cy - S * 0.1, cx + S * 0.1, cy + S * 0.1, [[0, '#ffd27d'], [1, '#e0742c']]);
        ctx.beginPath();
        ctx.arc(cx, cy, S * 0.11, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#f7e1b5';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.ellipse(cx, cy, S * 0.17, S * 0.045, -0.3, 0.15, Math.PI - 0.15);
        ctx.stroke();
        ctx.fillStyle = '#f7f3e3';
        ctx.beginPath();
        ctx.arc(S * 0.14, S * 0.13, S * 0.07, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#0d1b3e';
        ctx.beginPath();
        ctx.arc(S * 0.17, S * 0.11, S * 0.06, 0, Math.PI * 2);
        ctx.fill();
    },

    // Northern lights over mountains and a still lake
    aurora(ctx, S, rnd) {
        ctx.fillStyle = this.gradient(ctx, 0, 0, 0, S, [[0, '#06122b'], [0.6, '#123a5a'], [1, '#0a2238']]);
        ctx.fillRect(0, 0, S, S);
        for (let i = 0; i < 110; i++) {
            ctx.fillStyle = `rgba(255,255,255,${0.2 + rnd() * 0.7})`;
            ctx.beginPath();
            ctx.arc(rnd() * S, rnd() * S * 0.6, 0.8 + rnd() * 1.4, 0, Math.PI * 2);
            ctx.fill();
        }
        [['rgba(64,240,170,0.55)', 0.22, 0], ['rgba(120,220,255,0.45)', 0.32, 1.7], ['rgba(190,110,255,0.4)', 0.42, 3.1]].forEach(([color, y0, ph]) => {
            ctx.fillStyle = color;
            ctx.beginPath();
            for (let x = 0; x <= S; x += 4) ctx.lineTo(x, S * y0 + Math.sin(x / S * 7 + ph) * S * 0.05);
            for (let x = S; x >= 0; x -= 4) ctx.lineTo(x, S * (y0 + 0.07) + Math.sin(x / S * 7 + ph + 0.6) * S * 0.07);
            ctx.closePath();
            ctx.fill();
        });
        const peaks = [[0, 0.62], [0.12, 0.48], [0.24, 0.58], [0.38, 0.4], [0.52, 0.56], [0.66, 0.45], [0.8, 0.57], [0.92, 0.5], [1, 0.6]];
        const water = S * 0.66;
        ctx.fillStyle = '#16233a';
        ctx.beginPath();
        ctx.moveTo(0, water);
        peaks.forEach(([x, y]) => ctx.lineTo(x * S, y * S));
        ctx.lineTo(S, water);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#e8f1ff';
        [[0.38, 0.4], [0.66, 0.45], [0.12, 0.48]].forEach(([x, y]) => {
            ctx.beginPath();
            ctx.moveTo(x * S, y * S);
            ctx.lineTo(x * S - S * 0.04, y * S + S * 0.05);
            ctx.lineTo(x * S + S * 0.04, y * S + S * 0.05);
            ctx.closePath();
            ctx.fill();
        });
        ctx.fillStyle = this.gradient(ctx, 0, water, 0, S, [[0, '#1e4d6b'], [1, '#081a2c']]);
        ctx.fillRect(0, water, S, S - water);
        ctx.fillStyle = 'rgba(64,240,170,0.25)';
        for (let i = 0; i < 9; i++) ctx.fillRect(S * (0.05 + i * 0.1), water + S * (0.03 + (i % 3) * 0.08), S * 0.08, 3);
        ctx.fillStyle = '#c96f3b';
        ctx.beginPath();
        ctx.moveTo(S * 0.18, S * 0.86); ctx.lineTo(S * 0.36, S * 0.86); ctx.lineTo(S * 0.32, S * 0.9); ctx.lineTo(S * 0.21, S * 0.9);
        ctx.closePath();
        ctx.fill();
    }
};
