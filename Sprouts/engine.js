/**
 * Sprouts. Spots are joined by curves. A move draws a curve from a spot to
 * another spot (or back to itself) without crossing any curve, then puts a
 * new spot on the middle of that curve. A spot can have at most three curve
 * ends (a loop uses two). The player who cannot move loses.
 * Geometry lives on a SIZE x SIZE board; curves are polylines.
 */
const SproutsEngine = {
    SIZE: 400,
    SPOT_RADIUS: 9,
    MARGIN: 11,          // minimum distance between a curve and anything it must not touch
    MAX_LINES: 3,
    GRID: 6,             // AI pathfinding cell size
    CLEARANCE: 7,        // how far the AI keeps its curves from existing lines

    create(level) {
        const spots = level.spots.map(([x, y]) => ({ x: x * this.SIZE, y: y * this.SIZE, lines: 0 }));
        return { spots, curves: [] };
    },

    clone(state) {
        return { spots: state.spots.map(s => ({ ...s })), curves: state.curves.map(c => ({ ...c, points: c.points.slice() })) };
    },

    free(state, i) {
        return this.MAX_LINES - state.spots[i].lines;
    },

    dist(p, q) {
        return Math.hypot(p[0] - q[0], p[1] - q[1]);
    },

    // Distance from point p to segment ab
    segmentDistance(p, a, b) {
        const dx = b[0] - a[0];
        const dy = b[1] - a[1];
        const len2 = dx * dx + dy * dy;
        const t = len2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2)) : 0;
        return this.dist(p, [a[0] + t * dx, a[1] + t * dy]);
    },

    cross(o, a, b) {
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    },

    // Proper crossing of segments pq and rs (shared endpoints do not count)
    segmentsCross(p, q, r, s) {
        const d1 = this.cross(r, s, p);
        const d2 = this.cross(r, s, q);
        const d3 = this.cross(p, q, r);
        const d4 = this.cross(p, q, s);
        return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0)) && d1 !== 0 && d2 !== 0 && d3 !== 0 && d4 !== 0;
    },

    // Why a polyline from spot a to spot b is not a legal curve, or null when it is.
    // Segments near the endpoints may pass through the endpoint spots themselves.
    invalidReason(state, points, a, b) {
        if (a === b ? this.free(state, a) < 2 : this.free(state, a) < 1 || this.free(state, b) < 1) return 'full';
        if (points.length < 3) return 'short';
        let length = 0;
        for (let i = 1; i < points.length; i++) length += this.dist(points[i - 1], points[i]);
        if (length < this.SPOT_RADIUS * 6) return 'short';

        for (let i = 1; i < points.length; i++) {
            const p = points[i - 1];
            const q = points[i];
            // other spots must stay clear of the curve
            for (let s = 0; s < state.spots.length; s++) {
                if (s === a || s === b) continue;
                const spot = state.spots[s];
                if (this.segmentDistance([spot.x, spot.y], p, q) < this.SPOT_RADIUS + this.MARGIN / 2) return 'spot';
            }
            // existing curves must not be crossed
            for (const curve of state.curves) {
                for (let j = 1; j < curve.points.length; j++) {
                    if (this.segmentsCross(p, q, curve.points[j - 1], curve.points[j])) return 'cross';
                }
            }
            // the curve must not cross itself (neighboring segments share a point and are skipped)
            for (let j = 1; j < i - 1; j++) {
                if (this.segmentsCross(p, q, points[j - 1], points[j])) return 'self';
            }
        }
        // a loop must actually leave the spot and come back, not hug it
        if (a === b) {
            const far = points.some(pt => this.dist(pt, [state.spots[a].x, state.spots[a].y]) > this.SPOT_RADIUS * 3);
            if (!far) return 'short';
        }
        return null;
    },

    // Point halfway along the polyline, by length
    midpoint(points) {
        let total = 0;
        for (let i = 1; i < points.length; i++) total += this.dist(points[i - 1], points[i]);
        let run = 0;
        for (let i = 1; i < points.length; i++) {
            const d = this.dist(points[i - 1], points[i]);
            if (run + d >= total / 2) {
                const t = d ? (total / 2 - run) / d : 0;
                return { point: [points[i - 1][0] + t * (points[i][0] - points[i - 1][0]), points[i - 1][1] + t * (points[i][1] - points[i - 1][1])], index: i };
            }
            run += d;
        }
        return { point: points[points.length - 1], index: points.length - 1 };
    },

    // Applies a legal move: adds the curve, split in two at the new spot
    apply(state, points, a, b, owner) {
        const next = this.clone(state);
        const { point, index } = this.midpoint(points);
        const newIdx = next.spots.length;
        next.spots.push({ x: point[0], y: point[1], lines: 2 });
        next.spots[a].lines += 1;
        next.spots[b].lines += 1;
        next.curves.push({ points: [...points.slice(0, index), point], a, b: newIdx, owner });
        next.curves.push({ points: [point, ...points.slice(index)], a: newIdx, b, owner });
        return next;
    },

    // ---------- AI: finds curves with a grid search ----------
    // Obstacle grid for a state: cells near curves or the border are blocked;
    // each cell also lists the spots whose clearance zone covers it
    obstacleGrid(state) {
        const n = Math.ceil(this.SIZE / this.GRID);
        const base = Array.from({ length: n }, () => new Uint8Array(n));
        const spots = Array.from({ length: n }, () => Array.from({ length: n }, () => []));
        const segments = state.curves.flatMap(c => c.points.slice(1).map((q, i) => [c.points[i], q]));
        for (let gy = 0; gy < n; gy++) {
            for (let gx = 0; gx < n; gx++) {
                const p = [(gx + 0.5) * this.GRID, (gy + 0.5) * this.GRID];
                if (p[0] < this.CLEARANCE || p[1] < this.CLEARANCE || p[0] > this.SIZE - this.CLEARANCE || p[1] > this.SIZE - this.CLEARANCE) { base[gy][gx] = 1; continue; }
                for (const [a, b] of segments) {
                    if (this.segmentDistance(p, a, b) < this.CLEARANCE) { base[gy][gx] = 1; break; }
                }
                state.spots.forEach((spot, s) => {
                    if (this.dist(p, [spot.x, spot.y]) < this.SPOT_RADIUS + this.MARGIN) spots[gy][gx].push(s);
                });
            }
        }
        return { n, base, spots };
    },

    cellOf(p) {
        return [Math.floor(p[0] / this.GRID), Math.floor(p[1] / this.GRID)];
    },

    // A curve from spot a to spot b that stays clear of everything, or null
    findCurve(state, a, b, grid = this.obstacleGrid(state)) {
        const { n, base, spots } = grid;
        // Around the two endpoints the curves attached to them must not block the way out,
        // so there only other spots count; the final validity check still rejects crossings
        const nearEnd = (x, y) => spots[y][x].includes(a) || spots[y][x].includes(b);
        const extraBlocked = new Set();
        const blocked = (x, y) => extraBlocked.has(x * n + y)
            || spots[y][x].some(s => s !== a && s !== b)
            || (!nearEnd(x, y) && base[y][x]);
        const start = this.cellOf([state.spots[a].x, state.spots[a].y]);
        const goal = this.cellOf([state.spots[b].x, state.spots[b].y]);
        const key = ([x, y]) => x * n + y;

        for (let attempt = 0; attempt < 8; attempt++) {
            const prev = new Map();
            const queue = [start];
            prev.set(key(start), null);
            let found = false;
            for (let head = 0; head < queue.length && !found; head++) {
                const cur = queue[head];
                for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                    const nx = [cur[0] + dx, cur[1] + dy];
                    if (nx[0] < 0 || nx[1] < 0 || nx[0] >= n || nx[1] >= n || blocked(nx[0], nx[1]) || prev.has(key(nx))) continue;
                    prev.set(key(nx), cur);
                    if (nx[0] === goal[0] && nx[1] === goal[1]) { found = true; break; }
                    queue.push(nx);
                }
            }
            if (!found) return null;
            const cells = [];
            for (let c = goal; c; c = prev.get(key(c))) cells.push(c);
            cells.reverse();
            const points = [[state.spots[a].x, state.spots[a].y],
                ...cells.slice(1, -1).map(([x, y]) => [(x + 0.5) * this.GRID, (y + 0.5) * this.GRID]),
                [state.spots[b].x, state.spots[b].y]];
            if (!this.invalidReason(state, points, a, b)) return points;
            // The route crossed an attached curve near an endpoint: forbid its first step and look again
            if (cells.length < 2) return null;
            extraBlocked.add(key(cells[1]));
        }
        return null;
    },

    // A small loop next to spot a, in the first direction with room, or null
    findLoop(state, a) {
        const spot = state.spots[a];
        for (const r of [this.SPOT_RADIUS * 3, this.SPOT_RADIUS * 2]) for (let k = 0; k < 12; k++) {
            const angle = (Math.PI / 6) * k;
            const cx = spot.x + Math.cos(angle) * r;
            const cy = spot.y + Math.sin(angle) * r;
            const points = [];
            for (let i = 0; i <= 24; i++) {
                const t = angle + Math.PI + (i / 24) * Math.PI * 2;
                points.push([cx + Math.cos(t) * r, cy + Math.sin(t) * r]);
            }
            points[0] = [spot.x, spot.y];
            points[points.length - 1] = [spot.x, spot.y];
            if (points.every(p => p[0] > 0 && p[1] > 0 && p[0] < this.SIZE && p[1] < this.SIZE)
                && !this.invalidReason(state, points, a, a)) return points;
        }
        return null;
    },

    // Every move the side to play could make
    legalMoves(state) {
        const moves = [];
        const n = state.spots.length;
        const grid = this.obstacleGrid(state);
        for (let a = 0; a < n; a++) {
            if (this.free(state, a) >= 2) {
                const loop = this.findLoop(state, a);
                if (loop) moves.push({ a, b: a, points: loop });
            }
            if (this.free(state, a) < 1) continue;
            for (let b = a + 1; b < n; b++) {
                if (this.free(state, b) < 1) continue;
                const points = this.findCurve(state, a, b, grid);
                if (points) moves.push({ a, b, points });
            }
        }
        return moves;
    },

    // Runs fn with a finer, tighter search grid: slower, but finds curves in cramped spots
    withFineSearch(fn) {
        const saved = [this.GRID, this.CLEARANCE];
        [this.GRID, this.CLEARANCE] = [3, 4];
        try { return fn(); } finally { [this.GRID, this.CLEARANCE] = saved; }
    },

    // All moves, falling back to the fine search before concluding there are none
    allMoves(state) {
        const moves = this.legalMoves(state);
        return moves.length ? moves : this.withFineSearch(() => this.legalMoves(state));
    },

    hasMove(state) {
        return this.allMoves(state).length > 0;
    },

    getNoviceMove(state) {
        const moves = this.allMoves(state);
        return moves.length ? moves[Math.floor(Math.random() * moves.length)] : null;
    },

    // Master: leaves the opponent as few moves as possible, winning outright when it can
    getMasterMove(state, owner) {
        const moves = this.allMoves(state);
        if (!moves.length) return null;
        let best = null;
        for (const move of moves) {
            const next = this.apply(state, move.points, move.a, move.b, owner);
            const replies = this.legalMoves(next).length;
            if (replies === 0) return move;
            if (!best || replies < best.replies) best = { move, replies };
        }
        return best.move;
    }
};
