/**
 * Breakout. A paddle at the bottom keeps the ball in play; the ball breaks
 * bricks it hits. Bricks have a durability (1-3 hits). Lose a life when the
 * ball falls below the paddle; clear every brick to win.
 * Level: `rows` of characters ('.' empty, '1'-'3' durability), `speed` px/s.
 */
const BreakoutEngine = {
    WIDTH: 480,
    HEIGHT: 400,
    BRICK_W: 44,
    BRICK_H: 18,
    BRICK_TOP: 50,
    PADDLE_Y: 376,
    PADDLE_H: 10,
    BALL_R: 6,
    LIVES: 3,
    COLORS: ['#e03b3b', '#ff8c1a', '#f5b301', '#1f9d55', '#3b6fe0', '#9b4ddb', '#17b8c8'],

    create(level) {
        const bricks = [];
        const cols = Math.max(...level.rows.map(r => r.length));
        const left = (this.WIDTH - cols * (this.BRICK_W + 4)) / 2;
        level.rows.forEach((row, r) => [...row].forEach((ch, c) => {
            if (ch === '.') return;
            bricks.push({ x: left + c * (this.BRICK_W + 4), y: this.BRICK_TOP + r * (this.BRICK_H + 4), w: this.BRICK_W, h: this.BRICK_H, hp: Number(ch), color: this.COLORS[r % this.COLORS.length] });
        }));
        const state = { bricks, paddle: { x: this.WIDTH / 2, w: level.paddle || 80 }, ball: null, speed: level.speed, lives: this.LIVES, score: 0, won: false, lost: false, launched: false };
        this.resetBall(state);
        return state;
    },

    resetBall(state) {
        state.ball = { x: state.paddle.x, y: this.PADDLE_Y - this.BALL_R - 1, vx: 0, vy: 0 };
        state.launched = false;
    },

    launch(state) {
        if (state.launched || state.won || state.lost) return;
        const angle = (-60 + Math.random() * 120) * Math.PI / 180;
        state.ball.vx = Math.sin(angle) * state.speed;
        state.ball.vy = -Math.cos(angle) * state.speed;
        state.launched = true;
    },

    movePaddle(state, x) {
        const half = state.paddle.w / 2;
        state.paddle.x = Math.max(half, Math.min(this.WIDTH - half, x));
        if (!state.launched) state.ball.x = state.paddle.x;
    },

    // Advances the ball by dt seconds; returns events: 'brick', 'paddle', 'life', 'won', 'lost'
    step(state, dt) {
        const events = [];
        if (state.won || state.lost || !state.launched) return events;
        const b = state.ball;
        const r = this.BALL_R;
        // sub-steps keep fast balls from tunnelling through bricks
        const steps = Math.ceil(Math.hypot(b.vx, b.vy) * dt / 4);
        for (let s = 0; s < steps; s++) {
            const prevX = b.x;
            const prevY = b.y;
            b.x += b.vx * dt / steps;
            b.y += b.vy * dt / steps;
            if (b.x < r) { b.x = r; b.vx = Math.abs(b.vx); }
            if (b.x > this.WIDTH - r) { b.x = this.WIDTH - r; b.vx = -Math.abs(b.vx); }
            if (b.y < r) { b.y = r; b.vy = Math.abs(b.vy); }
            // paddle
            const p = state.paddle;
            if (b.vy > 0 && b.y + r >= this.PADDLE_Y && b.y + r <= this.PADDLE_Y + this.PADDLE_H + 6 && Math.abs(b.x - p.x) <= p.w / 2 + r) {
                const offset = (b.x - p.x) / (p.w / 2); // -1..1
                const angle = offset * 60 * Math.PI / 180;
                const speed = Math.hypot(b.vx, b.vy);
                b.vx = Math.sin(angle) * speed;
                b.vy = -Math.cos(angle) * speed;
                b.y = this.PADDLE_Y - r;
                events.push('paddle');
            }
            // bricks
            for (const brick of state.bricks) {
                if (brick.hp <= 0) continue;
                const nx = Math.max(brick.x, Math.min(b.x, brick.x + brick.w));
                const ny = Math.max(brick.y, Math.min(b.y, brick.y + brick.h));
                if ((b.x - nx) ** 2 + (b.y - ny) ** 2 > r * r) continue;
                // The side hit is the one the ball crossed this step: if it was level with
                // the brick before, it came from the side; otherwise from above or below
                const wasBeside = prevY + r > brick.y && prevY - r < brick.y + brick.h;
                const wasAbove = prevX + r > brick.x && prevX - r < brick.x + brick.w;
                if (wasBeside && !wasAbove) {
                    b.vx = -b.vx;
                    b.x = b.vx > 0 ? brick.x + brick.w + r : brick.x - r;
                } else {
                    b.vy = -b.vy;
                    b.y = b.vy > 0 ? brick.y + brick.h + r : brick.y - r;
                }
                brick.hp--;
                state.score += 10;
                events.push('brick');
                break;
            }
            if (b.y - r > this.HEIGHT) {
                state.lives--;
                events.push('life');
                if (state.lives <= 0) { state.lost = true; events.push('lost'); }
                else this.resetBall(state);
                return events;
            }
        }
        if (state.bricks.every(k => k.hp <= 0)) { state.won = true; events.push('won'); }
        return events;
    }
};
