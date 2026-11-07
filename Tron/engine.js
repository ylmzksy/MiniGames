/**
 * Tron light cycles. Two riders move every tick and leave permanent trails.
 * Riding into a wall or any trail crashes. The AI picks its direction by
 * flood-filling the free space it would keep.
 * grid[r][c]: 0 free, 1 your trail, 2 the AI's trail.
 */
const TronEngine = {
    directions: { up: [-1, 0], down: [1, 0], left: [0, -1], right: [0, 1] },
    opposite: { up: 'down', down: 'up', left: 'right', right: 'left' },

    create(level) {
        const grid = Array.from({ length: level.height }, () => new Uint8Array(level.width));
        const mid = Math.floor(level.height / 2);
        const player = { r: mid, c: 2, dir: 'right' };
        const ai = { r: mid, c: level.width - 3, dir: 'left' };
        grid[player.r][player.c] = 1;
        grid[ai.r][ai.c] = 2;
        return { width: level.width, height: level.height, grid, player, ai, over: false, winner: null, ticks: 0 };
    },

    free(state, r, c) {
        return r >= 0 && c >= 0 && r < state.height && c < state.width && state.grid[r][c] === 0;
    },

    ahead(rider, dir) {
        const [dr, dc] = this.directions[dir];
        return [rider.r + dr, rider.c + dc];
    },

    // Reachable free cells from (r, c), capped for speed
    area(state, r, c, cap = 4000) {
        if (!this.free(state, r, c)) return 0;
        const seen = new Set([r * state.width + c]);
        const queue = [[r, c]];
        for (let head = 0; head < queue.length && seen.size < cap; head++) {
            const [qr, qc] = queue[head];
            for (const [dr, dc] of Object.values(this.directions)) {
                const nr = qr + dr;
                const nc = qc + dc;
                if (this.free(state, nr, nc) && !seen.has(nr * state.width + nc)) { seen.add(nr * state.width + nc); queue.push([nr, nc]); }
            }
        }
        return seen.size;
    },

    // Master: the direction keeping the most space after a two-ply look ahead; Novice: safe but careless
    aiMove(state, difficulty) {
        const dirs = Object.keys(this.directions).filter(d => d !== this.opposite[state.ai.dir]);
        const safe = dirs.filter(d => this.free(state, ...this.ahead(state.ai, d)));
        if (!safe.length) return state.ai.dir;
        if (difficulty !== 'master') {
            if (Math.random() < 0.7 && safe.includes(state.ai.dir)) return state.ai.dir;
            return safe[Math.floor(Math.random() * safe.length)];
        }
        // Block the player's likely next cell so the AI prefers space the player cannot reach first
        const [pr, pc] = this.ahead(state.player, state.player.dir);
        let best = null;
        for (const d of safe) {
            const [r, c] = this.ahead(state.ai, d);
            state.grid[r][c] = 2;
            const blockedPlayer = this.free(state, pr, pc);
            if (blockedPlayer) state.grid[pr][pc] = 1;
            let score = 0;
            // second ply: the best continuation from the new cell
            for (const d2 of Object.keys(this.directions)) {
                if (d2 === this.opposite[d]) continue;
                const [r2, c2] = this.ahead({ r, c }, d2);
                score = Math.max(score, this.area(state, r2, c2));
            }
            score += this.area(state, r, c) * 0.001 + (d === state.ai.dir ? 0.5 : 0);
            if (blockedPlayer) state.grid[pr][pc] = 0;
            state.grid[r][c] = 0;
            if (!best || score > best.score) best = { d, score };
        }
        return best.d;
    },

    step(state, playerDir, difficulty) {
        if (state.over) return state;
        state.ticks++;
        if (playerDir && playerDir !== this.opposite[state.player.dir]) state.player.dir = playerDir;
        state.ai.dir = this.aiMove(state, difficulty);
        const [pr, pc] = this.ahead(state.player, state.player.dir);
        const [ar, ac] = this.ahead(state.ai, state.ai.dir);
        const playerCrash = !this.free(state, pr, pc);
        const aiCrash = !this.free(state, ar, ac);
        const headOn = pr === ar && pc === ac;
        if (playerCrash || aiCrash || headOn) {
            state.over = true;
            state.winner = (playerCrash || headOn) && (aiCrash || headOn) ? 'draw' : playerCrash ? 'ai' : 'player';
            if (!playerCrash && !headOn) { state.player.r = pr; state.player.c = pc; state.grid[pr][pc] = 1; }
            if (!aiCrash && !headOn) { state.ai.r = ar; state.ai.c = ac; state.grid[ar][ac] = 2; }
            return state;
        }
        state.player.r = pr; state.player.c = pc; state.grid[pr][pc] = 1;
        state.ai.r = ar; state.ai.c = ac; state.grid[ar][ac] = 2;
        return state;
    }
};
