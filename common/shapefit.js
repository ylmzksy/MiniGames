/**
 * Shared code for the shape-fitting games (Tangram, Dissections).
 * Pieces are convex polygons in puzzle units. A placement is
 * { x, y, rot, flip }: the local polygon is mirrored (x -> -x) when flip is
 * set, rotated by rot degrees, then moved by (x, y). The target silhouette of
 * a level is the union of its solution placements, so every level is exactly
 * solvable. Completion is judged by rasterizing target and pieces.
 */
const ShapeFit = {
    EPS: 1e-3,

    transform(local, place) {
        const rad = (place.rot * Math.PI) / 180;
        const c = Math.cos(rad);
        const s = Math.sin(rad);
        return local.map(([lx, ly]) => {
            const fx = place.flip ? -lx : lx;
            return [place.x + fx * c - ly * s, place.y + fx * s + ly * c];
        });
    },

    centroid(poly) {
        // area-weighted centroid (shoelace)
        let a = 0, cx = 0, cy = 0;
        for (let i = 0; i < poly.length; i++) {
            const [x1, y1] = poly[i];
            const [x2, y2] = poly[(i + 1) % poly.length];
            const cross = x1 * y2 - x2 * y1;
            a += cross;
            cx += (x1 + x2) * cross;
            cy += (y1 + y2) * cross;
        }
        a /= 2;
        return a === 0 ? poly[0] : [cx / (6 * a), cy / (6 * a)];
    },

    area(poly) {
        let a = 0;
        for (let i = 0; i < poly.length; i++) {
            const [x1, y1] = poly[i];
            const [x2, y2] = poly[(i + 1) % poly.length];
            a += x1 * y2 - x2 * y1;
        }
        return Math.abs(a) / 2;
    },

    bbox(polys) {
        const xs = polys.flat().map(p => p[0]);
        const ys = polys.flat().map(p => p[1]);
        return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
    },

    // Finds the placement that maps `local` onto `world`, or null when the shapes differ
    fit(local, world, step) {
        if (local.length !== world.length) return null;
        const n = local.length;
        for (const flip of [false, true]) {
            for (let rot = 0; rot < 360; rot += step) {
                const pts = this.transform(local, { x: 0, y: 0, rot, flip });
                for (let k = 0; k < n; k++) {
                    for (const dir of [1, -1]) {
                        const tx = world[k][0] - pts[0][0];
                        const ty = world[k][1] - pts[0][1];
                        let ok = true;
                        for (let i = 0; i < n && ok; i++) {
                            const w = world[((k + dir * i) % n + n) % n];
                            if (Math.abs(pts[i][0] + tx - w[0]) > this.EPS || Math.abs(pts[i][1] + ty - w[1]) > this.EPS) ok = false;
                        }
                        if (ok) return { x: tx, y: ty, rot, flip };
                    }
                }
            }
        }
        return null;
    },

    samePolygon(a, b, tol = 0.05) {
        if (a.length !== b.length) return false;
        const n = a.length;
        for (let k = 0; k < n; k++) {
            for (const dir of [1, -1]) {
                let ok = true;
                for (let i = 0; i < n && ok; i++) {
                    const w = b[((k + dir * i) % n + n) % n];
                    if (Math.hypot(a[i][0] - w[0], a[i][1] - w[1]) > tol) ok = false;
                }
                if (ok) return true;
            }
        }
        return false;
    },

    shrink(poly, factor) {
        const [cx, cy] = this.centroid(poly);
        return poly.map(([x, y]) => [cx + (x - cx) * factor, cy + (y - cy) * factor]);
    },

    // Rasterizes target and pieces: coverage of the target, spill outside it, and overlap between pieces
    check(targetPolys, piecePolys, px = 12) {
        const box = this.bbox(targetPolys);
        const ox = box.minX - 1;
        const oy = box.minY - 1;
        const w = Math.ceil((box.maxX - box.minX + 2) * px);
        const h = Math.ceil((box.maxY - box.minY + 2) * px);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        const paint = polys => {
            ctx.clearRect(0, 0, w, h);
            ctx.fillStyle = '#000';
            polys.forEach(poly => {
                ctx.beginPath();
                poly.forEach(([x, y], i) => ctx[i ? 'lineTo' : 'moveTo']((x - ox) * px, (y - oy) * px));
                ctx.closePath();
                ctx.fill();
            });
            const data = ctx.getImageData(0, 0, w, h).data;
            const mask = new Uint8Array(w * h);
            for (let i = 0; i < w * h; i++) mask[i] = data[i * 4 + 3] > 127 ? 1 : 0;
            return mask;
        };
        const target = paint(targetPolys);
        const union = paint(piecePolys);
        let targetCount = 0, covered = 0, outside = 0, unionCount = 0;
        for (let i = 0; i < w * h; i++) {
            if (target[i]) { targetCount++; if (union[i]) covered++; }
            if (union[i]) { unionCount++; if (!target[i]) outside++; }
        }
        // overlap: shrunk pieces only overlap when one really lies on another
        const shrunk = piecePolys.map(p => this.shrink(p, 0.94));
        const shrunkUnion = paint(shrunk).reduce((s, v) => s + v, 0);
        let shrunkSum = 0;
        shrunk.forEach(p => { shrunkSum += paint([p]).reduce((s, v) => s + v, 0); });
        const coverage = targetCount ? covered / targetCount : 0;
        const spill = unionCount ? outside / unionCount : 0;
        const overlap = shrunkUnion ? shrunkSum / shrunkUnion - 1 : 0;
        return { coverage, spill, overlap, solved: coverage >= 0.97 && spill <= 0.02 && overlap <= 0.03 };
    }
};

/**
 * The game controller: level loading, tray layout, SVG rendering, dragging
 * with vertex snapping, rotation/flip, hints and the solved flow.
 *   config.sets: { name: { pieceName: localPolygon } }
 *   config.rotationStep: degrees per rotation
 * A level: { name, set?, solution: { pieceName: worldPolygon } }
 */
const ShapeFitGame = {
    palette: ['#e03b3b', '#3b6fe0', '#1f9d55', '#f5b301', '#9b4ddb', '#ff8c1a', '#17b8c8', '#f06ab0', '#8a94a6', '#7fd36b', '#b08968', '#6fb4ff', '#c9a227', '#e07bb0'],
    SNAP: 0.4,
    GRID: 0.25,

    init(config) {
        this.config = config;
        this.board = document.getElementById('game-board');
        this.statusEl = document.getElementById('status');
        this.levelInfoEl = document.getElementById('level-info');
        this.countersEl = document.getElementById('counters');
        this.statusKey = 'status_play';
        this.drag = null;
        this.hint = null;

        this.board.addEventListener('pointerdown', e => this.onPointerDown(e));
        this.board.addEventListener('pointermove', e => this.onPointerMove(e));
        this.board.addEventListener('pointerup', e => this.onPointerUp(e));
        this.board.addEventListener('pointercancel', e => this.onPointerUp(e));

        document.addEventListener('keydown', (event) => {
            const inFormControl = event.target instanceof Element && event.target.closest('select, input');
            if (inFormControl || document.querySelector('.modal.active')) return;
            if (event.key === 'r') this.rotate(this.config.rotationStep);
            else if (event.key === 'R') this.rotate(-this.config.rotationStep);
            else if (event.key.toLowerCase() === 'f') this.flip();
            else if (event.key.toLowerCase() === 'h') this.showHint();
            else if (event.key === 'Escape') { this.selected = null; this.render(); }
            else return;
            event.preventDefault();
        });

        document.getElementById('rotateBtn').onclick = () => this.rotate(this.config.rotationStep);
        document.getElementById('rotateBackBtn').onclick = () => this.rotate(-this.config.rotationStep);
        document.getElementById('flipBtn').onclick = () => this.flip();
        document.getElementById('hintBtn').onclick = () => this.showHint();
        document.getElementById('restartBtn').onclick = () => this.loadLevel(this.currentLevelIdx);
        window.addEventListener('langChanged', () => {
            this.setStatus(this.statusKey);
            this.updateLevelInfo();
            this.render();
        });

        if (LevelRegistry.length > 0) this.loadLevel(Progress.startLevel());
    },

    loadLevel(idx) {
        this.level = LevelRegistry[idx];
        if (!this.level) return;
        this.currentLevelIdx = idx;
        Progress.setCurrent(idx);
        const set = this.config.sets[this.level.set || Object.keys(this.config.sets)[0]];
        this.pieces = Object.keys(set).map((name, i) => ({ name, local: set[name], color: this.palette[i % this.palette.length] }));
        this.loadError = false;
        this.solution = {};
        this.pieces.forEach(p => {
            const world = this.level.solution[p.name];
            const place = world ? ShapeFit.fit(p.local, world, this.config.rotationStep) : null;
            if (!place) { this.loadError = true; console.error('piece does not fit its solution polygon', p.name); }
            this.solution[p.name] = place || { x: 0, y: 0, rot: 0, flip: false };
        });
        this.target = this.pieces.map(p => this.level.solution[p.name] || []);
        this.layoutTray();
        this.selected = null;
        this.hint = null;
        this.isSolved = false;
        this.setStatus(this.loadError ? 'status_error' : 'status_play');
        this.updateLevelInfo();
        this.render();
    },

    // Unused pieces start in rows below the silhouette
    layoutTray() {
        const box = ShapeFit.bbox(this.target);
        const width = Math.max(box.maxX - box.minX, 8);
        let cursor = box.minX;
        let rowTop = box.maxY + 1.5;
        let rowHeight = 0;
        this.places = {};
        this.pieces.forEach(p => {
            const lb = ShapeFit.bbox([p.local]);
            const w = lb.maxX - lb.minX;
            const h = lb.maxY - lb.minY;
            if (cursor > box.minX && cursor + w > box.minX + width) {
                cursor = box.minX;
                rowTop += rowHeight + 0.6;
                rowHeight = 0;
            }
            this.places[p.name] = { x: cursor - lb.minX, y: rowTop - lb.minY, rot: 0, flip: false };
            cursor += w + 0.6;
            rowHeight = Math.max(rowHeight, h);
        });
        this.order = this.pieces.map(p => p.name);
        this.view = { minX: box.minX - 1, minY: box.minY - 1, maxX: Math.max(box.maxX, box.minX + width) + 1, maxY: rowTop + rowHeight + 1 };
    },

    world(name) {
        const piece = this.pieces.find(p => p.name === name);
        return ShapeFit.transform(piece.local, this.places[name]);
    },

    render() {
        const v = this.view;
        const fmt = poly => poly.map(([x, y]) => `${x.toFixed(3)},${y.toFixed(3)}`).join(' ');
        const silhouette = this.target.map(poly => `<polygon class="target" points="${fmt(poly)}"></polygon>`).join('');
        const hint = this.hint ? `<polygon class="hint" points="${fmt(this.level.solution[this.hint])}"></polygon>` : '';
        const pieces = this.order.map(name => {
            const piece = this.pieces.find(p => p.name === name);
            const classes = ['piece', name === this.selected ? 'selected' : '', this.isSolved ? 'solved' : ''].join(' ');
            return `<polygon class="${classes}" data-name="${name}" points="${fmt(this.world(name))}" style="--piece:${piece.color}"></polygon>`;
        }).join('');
        this.board.innerHTML = `<svg viewBox="${v.minX} ${v.minY} ${v.maxX - v.minX} ${v.maxY - v.minY}" role="img">${silhouette}${hint}${pieces}</svg>`;
        const placed = this.pieces.filter(p => ShapeFit.samePolygon(this.world(p.name), this.level.solution[p.name])).length;
        this.countersEl.innerText = `${i18n.t('pieces')}: ${this.pieces.length} · ${i18n.t('in_place')}: ${placed}`;
    },

    toUnits(event) {
        const svg = this.board.querySelector('svg');
        const rect = svg.getBoundingClientRect();
        const v = this.view;
        const scale = (v.maxX - v.minX) / rect.width;
        return [v.minX + (event.clientX - rect.left) * scale, v.minY + (event.clientY - rect.top) * scale];
    },

    onPointerDown(event) {
        if (this.isSolved) return;
        const el = event.target.closest('.piece');
        if (!el) { this.selected = null; this.render(); return; }
        event.preventDefault();
        const name = el.dataset.name;
        this.selected = name;
        this.order = this.order.filter(n => n !== name).concat(name);
        const [ux, uy] = this.toUnits(event);
        const place = this.places[name];
        this.drag = { name, dx: place.x - ux, dy: place.y - uy, moved: false };
        this.board.setPointerCapture(event.pointerId);
        this.render();
    },

    onPointerMove(event) {
        if (!this.drag) return;
        const [ux, uy] = this.toUnits(event);
        const place = this.places[this.drag.name];
        place.x = ux + this.drag.dx;
        place.y = uy + this.drag.dy;
        this.drag.moved = true;
        this.render();
    },

    onPointerUp() {
        if (!this.drag) return;
        const { name, moved } = this.drag;
        this.drag = null;
        if (moved) this.snap(name);
        this.render();
        this.checkSolved();
    },

    // Pulls the nearest vertex onto a silhouette or piece vertex, otherwise onto the fine grid
    snap(name) {
        const mine = this.world(name);
        const candidates = [...this.target.flat(), ...this.order.filter(n => n !== name).flatMap(n => this.world(n))];
        let best = null;
        mine.forEach(v => candidates.forEach(c => {
            const d = Math.hypot(v[0] - c[0], v[1] - c[1]);
            if (d < this.SNAP && (!best || d < best.d)) best = { d, dx: c[0] - v[0], dy: c[1] - v[1] };
        }));
        const place = this.places[name];
        if (best) {
            place.x += best.dx;
            place.y += best.dy;
        } else {
            place.x = Math.round(place.x / this.GRID) * this.GRID;
            place.y = Math.round(place.y / this.GRID) * this.GRID;
        }
    },

    // Rotations and flips keep the piece's centroid where it is
    rotate(delta) {
        if (!this.selected || this.isSolved) return;
        this.retarget(this.selected, place => ({ ...place, rot: ((place.rot + delta) % 360 + 360) % 360 }));
    },

    flip() {
        if (!this.selected || this.isSolved) return;
        this.retarget(this.selected, place => ({ ...place, flip: !place.flip }));
    },

    retarget(name, change) {
        const piece = this.pieces.find(p => p.name === name);
        const before = ShapeFit.centroid(this.world(name));
        const next = change(this.places[name]);
        const moved = ShapeFit.centroid(ShapeFit.transform(piece.local, next));
        next.x += before[0] - moved[0];
        next.y += before[1] - moved[1];
        this.places[name] = next;
        this.snap(name);
        this.render();
        this.checkSolved();
    },

    // Shows where the first misplaced piece belongs
    showHint() {
        if (this.isSolved) return;
        const wrong = this.pieces.find(p => !ShapeFit.samePolygon(this.world(p.name), this.level.solution[p.name]));
        if (!wrong) return;
        this.hint = wrong.name;
        this.selected = wrong.name;
        this.setStatus('status_hint');
        this.render();
        clearTimeout(this.hintTimer);
        this.hintTimer = setTimeout(() => { this.hint = null; if (!this.isSolved) this.setStatus('status_play'); this.render(); }, 3000);
    },

    // Applies a placement directly (used by tests and could drive animations)
    place(name, place) {
        this.places[name] = { ...place };
        this.render();
        this.checkSolved();
    },

    checkSolved() {
        if (this.isSolved) return;
        const result = ShapeFit.check(this.target, this.order.map(n => this.world(n)));
        this.lastCheck = result;
        if (!result.solved) return;
        this.isSolved = true;
        this.selected = null;
        this.hint = null;
        this.setStatus('status_solved');
        Progress.markSolved(this.currentLevelIdx);
        this.render();
        const solvedLevelIdx = this.currentLevelIdx;
        setTimeout(() => {
            if (solvedLevelIdx === this.currentLevelIdx) this.nextLevel();
        }, 2000);
    },

    nextLevel() {
        if (this.currentLevelIdx + 1 < LevelRegistry.length) {
            this.loadLevel(this.currentLevelIdx + 1);
        } else {
            this.setStatus('all_levels_cleared');
        }
    },

    setStatus(key) {
        this.statusKey = key;
        this.statusEl.innerText = i18n.t(key);
    },

    updateLevelInfo() {
        this.levelInfoEl.innerText = `${i18n.t('level')} ${this.currentLevelIdx + 1}/${LevelRegistry.length}: ${this.level.name}`;
    }
};
