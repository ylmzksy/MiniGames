/**
 * Jigsaw. A picture is drawn from a seed and cut into rows x cols square
 * pieces. The pieces start shuffled; the puzzle is solved when every piece
 * sits in its own slot. Slot and piece indices run row by row.
 */
const JigsawEngine = {
    TILE: 100, // picture pixels per piece

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
        const count = level.rows * level.cols;
        const rand = this.rng(level.seed);
        const state = { rows: level.rows, cols: level.cols, seed: level.seed, slots: Array(count).fill(null), tray: [], rand };
        this.scatter(state);
        return state;
    },

    // Puts every unplaced piece back in the tray in a fresh random order
    scatter(state) {
        const placed = new Set(state.slots.filter(p => p !== null));
        const loose = [];
        for (let i = 0; i < state.slots.length; i++) if (!placed.has(i)) loose.push(i);
        for (let i = loose.length - 1; i > 0; i--) {
            const j = Math.floor(state.rand() * (i + 1));
            [loose[i], loose[j]] = [loose[j], loose[i]];
        }
        state.tray = loose;
    },

    slotOf(state, piece) {
        return state.slots.indexOf(piece);
    },

    // Drops a piece on a slot; an occupied slot swaps its piece into the dragged piece's old place
    drop(state, piece, slot) {
        const from = this.slotOf(state, piece);
        const other = state.slots[slot];
        if (other === piece) return;
        if (from >= 0) state.slots[from] = null; else state.tray = state.tray.filter(p => p !== piece);
        if (other !== null) {
            if (from >= 0) state.slots[from] = other; else state.tray.push(other);
        }
        state.slots[slot] = piece;
    },

    toTray(state, piece) {
        const from = this.slotOf(state, piece);
        if (from >= 0) { state.slots[from] = null; state.tray.push(piece); }
    },

    isLocked(state, piece) {
        return state.slots[piece] === piece;
    },

    isSolved(state) {
        return state.slots.every((p, i) => p === i);
    },

    // Draws a seeded landscape onto a canvas of the given size
    drawPicture(ctx, width, height, seed) {
        const rand = this.rng(seed * 7 + 1);
        const night = rand() < 0.3;
        const sky = ctx.createLinearGradient(0, 0, 0, height);
        const palettes = [['#7fb8e6', '#dff0ff'], ['#f9a66c', '#ffe4b5'], ['#8fd3f4', '#ffffff'], ['#c084fc', '#fde68a']];
        const [top, bottom] = night ? ['#0b1a3a', '#2c3e70'] : palettes[Math.floor(rand() * palettes.length)];
        sky.addColorStop(0, top);
        sky.addColorStop(1, bottom);
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, width, height);
        // stars or sun
        if (night) {
            ctx.fillStyle = '#fff';
            for (let i = 0; i < 40; i++) ctx.fillRect(rand() * width, rand() * height * 0.6, 2, 2);
            ctx.fillStyle = '#f7f1c2';
            ctx.beginPath(); ctx.arc(width * (0.2 + rand() * 0.6), height * 0.2, 26, 0, Math.PI * 2); ctx.fill();
        } else {
            ctx.fillStyle = '#ffd34d';
            ctx.beginPath(); ctx.arc(width * (0.15 + rand() * 0.7), height * (0.15 + rand() * 0.15), 30, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.9)';
            for (let i = 0; i < 3; i++) {
                const cx = rand() * width, cy = height * (0.1 + rand() * 0.25);
                [[0, 0, 22], [24, 6, 18], [-22, 8, 16], [8, 12, 20]].forEach(([dx, dy, r]) => { ctx.beginPath(); ctx.arc(cx + dx, cy + dy, r, 0, Math.PI * 2); ctx.fill(); });
            }
        }
        // hills
        const hillColors = night ? ['#1f3b2e', '#2d5a3f', '#3c7a52'] : ['#5b9e5b', '#79b86a', '#9ed37a'];
        for (let layer = 0; layer < 3; layer++) {
            ctx.fillStyle = hillColors[layer];
            const base = height * (0.5 + layer * 0.15);
            ctx.beginPath();
            ctx.moveTo(0, height);
            const bumps = 3 + Math.floor(rand() * 3);
            for (let i = 0; i <= bumps; i++) {
                const x = (i / bumps) * width;
                const y = base - rand() * height * 0.18;
                ctx.quadraticCurveTo(x - width / bumps / 2, base - height * 0.1, x, y);
            }
            ctx.lineTo(width, height);
            ctx.closePath();
            ctx.fill();
        }
        // lake
        if (rand() < 0.5) {
            ctx.fillStyle = night ? '#274b7a' : '#4aa3df';
            ctx.beginPath(); ctx.ellipse(width * (0.3 + rand() * 0.4), height * 0.88, width * 0.22, height * 0.06, 0, 0, Math.PI * 2); ctx.fill();
        }
        // house
        const hx = width * (0.15 + rand() * 0.6), hy = height * (0.62 + rand() * 0.1), hw = 70, hh = 50;
        ctx.fillStyle = ['#d9534f', '#f0ad4e', '#e8d9b0'][Math.floor(rand() * 3)];
        ctx.fillRect(hx, hy, hw, hh);
        ctx.fillStyle = '#6b3f2a';
        ctx.beginPath(); ctx.moveTo(hx - 8, hy); ctx.lineTo(hx + hw / 2, hy - 38); ctx.lineTo(hx + hw + 8, hy); ctx.closePath(); ctx.fill();
        ctx.fillStyle = night ? '#ffe9a8' : '#5a3a2a';
        ctx.fillRect(hx + hw / 2 - 9, hy + 20, 18, 30);
        ctx.fillStyle = night ? '#ffe9a8' : '#bfe6ff';
        ctx.fillRect(hx + 8, hy + 10, 16, 14); ctx.fillRect(hx + hw - 24, hy + 10, 16, 14);
        // trees
        const trees = 4 + Math.floor(rand() * 5);
        for (let i = 0; i < trees; i++) {
            const tx = rand() * width, ty = height * (0.6 + rand() * 0.3), th = 40 + rand() * 40;
            ctx.fillStyle = '#5a3a2a';
            ctx.fillRect(tx - 4, ty - th * 0.3, 8, th * 0.3);
            ctx.fillStyle = rand() < 0.5 ? '#2f7d3a' : '#3f9a48';
            if (rand() < 0.5) {
                ctx.beginPath(); ctx.moveTo(tx - th * 0.3, ty - th * 0.3); ctx.lineTo(tx, ty - th); ctx.lineTo(tx + th * 0.3, ty - th * 0.3); ctx.closePath(); ctx.fill();
            } else {
                ctx.beginPath(); ctx.arc(tx, ty - th * 0.55, th * 0.3, 0, Math.PI * 2); ctx.fill();
            }
        }
        // birds
        ctx.strokeStyle = night ? '#9fb3d9' : '#333';
        ctx.lineWidth = 2;
        const birds = Math.floor(rand() * 5);
        for (let i = 0; i < birds; i++) {
            const bx = rand() * width, by = height * (0.1 + rand() * 0.3);
            ctx.beginPath(); ctx.moveTo(bx - 10, by); ctx.quadraticCurveTo(bx - 5, by - 6, bx, by); ctx.quadraticCurveTo(bx + 5, by - 6, bx + 10, by); ctx.stroke();
        }
    }
};
