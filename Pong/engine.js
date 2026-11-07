/**
 * Pong. You control the left paddle, the AI the right one. The ball speeds
 * up a little on every paddle hit; the first side to reach the target wins.
 * Serves alternate between the sides.
 */
const PongEngine = {
    WIDTH: 480,
    HEIGHT: 320,
    PADDLE_W: 10,
    PADDLE_X: 20,
    BALL_R: 6,

    create(level) {
        const state = { paddleH: level.paddle, speed: level.speed, target: level.target,
            player: { y: this.HEIGHT / 2 }, ai: { y: this.HEIGHT / 2 }, ball: null,
            score: [0, 0], serveTo: 0, winner: null, hits: 0 };
        this.serve(state);
        return state;
    },

    // The ball starts from the center toward the side that serves next
    serve(state) {
        const dir = state.serveTo === 0 ? -1 : 1;
        const angle = (Math.random() * 60 - 30) * Math.PI / 180;
        state.ball = { x: this.WIDTH / 2, y: this.HEIGHT / 2, vx: dir * Math.cos(angle) * state.speed, vy: Math.sin(angle) * state.speed, speed: state.speed };
        state.serveTo = 1 - state.serveTo;
        state.hits = 0;
    },

    movePaddle(state, who, y) {
        const half = state.paddleH / 2;
        state[who].y = Math.max(half, Math.min(this.HEIGHT - half, y));
    },

    // Where the ball will cross x = targetX, following wall bounces (for the AI)
    predictY(state, targetX) {
        const b = state.ball;
        if (b.vx === 0) return b.y;
        const t = (targetX - b.x) / b.vx;
        if (t < 0) return this.HEIGHT / 2;
        let y = b.y + b.vy * t;
        const span = this.HEIGHT - 2 * this.BALL_R;
        y = ((y - this.BALL_R) % (2 * span) + 2 * span) % (2 * span);
        if (y > span) y = 2 * span - y;
        return y + this.BALL_R;
    },

    // Moves the AI paddle toward its goal at a limited speed
    aiMove(state, difficulty, dt) {
        const b = state.ball;
        let goal;
        let maxSpeed;
        if (difficulty === 'master') {
            goal = b.vx > 0 ? this.predictY(state, this.WIDTH - this.PADDLE_X) + (state.aiError || 0) : this.HEIGHT / 2;
            maxSpeed = state.speed * 0.9;
        } else {
            goal = b.vx > 0 ? b.y : this.HEIGHT / 2;
            maxSpeed = state.speed * 0.45;
        }
        const delta = goal - state.ai.y;
        const move = Math.max(-maxSpeed * dt, Math.min(maxSpeed * dt, delta));
        this.movePaddle(state, 'ai', state.ai.y + move);
    },

    step(state, dt) {
        const events = [];
        if (state.winner !== null) return events;
        const b = state.ball;
        const r = this.BALL_R;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        if (b.y < r) { b.y = r; b.vy = Math.abs(b.vy); }
        if (b.y > this.HEIGHT - r) { b.y = this.HEIGHT - r; b.vy = -Math.abs(b.vy); }
        const hit = (paddleX, paddle, dir) => {
            const offset = (b.y - paddle.y) / (state.paddleH / 2);
            const angle = Math.max(-1, Math.min(1, offset)) * 60 * Math.PI / 180;
            b.speed *= 1.04;
            b.vx = dir * Math.cos(angle) * b.speed;
            b.vy = Math.sin(angle) * b.speed;
            b.x = paddleX;
            state.hits++;
            // a fresh aiming error for the AI on every rally
            state.aiError = (Math.random() * 2 - 1) * 18;
            events.push('hit');
        };
        const left = this.PADDLE_X + this.PADDLE_W;
        const right = this.WIDTH - this.PADDLE_X - this.PADDLE_W;
        if (b.vx < 0 && b.x - r <= left && b.x - r >= left - 12 && Math.abs(b.y - state.player.y) <= state.paddleH / 2 + r) hit(left + r, state.player, 1);
        if (b.vx > 0 && b.x + r >= right && b.x + r <= right + 12 && Math.abs(b.y - state.ai.y) <= state.paddleH / 2 + r) hit(right - r, state.ai, -1);
        if (b.x < -r) { state.score[1]++; events.push('ai_point'); this.serve(state); }
        else if (b.x > this.WIDTH + r) { state.score[0]++; events.push('player_point'); this.serve(state); }
        if (state.score[0] >= state.target) { state.winner = 0; events.push('won'); }
        else if (state.score[1] >= state.target) { state.winner = 1; events.push('lost'); }
        return events;
    }
};
