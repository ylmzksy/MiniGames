const TICK_MS = 16;
const PADDLE_SPEED = 360;

let currentLevelIdx = 0;
let state = null;
let ticker = null;
let keyDir = 0;
let statusKey = 'status_play';
let gameId = 0;

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const levelInfoEl = document.getElementById('level-info');
const countersEl = document.getElementById('counters');

function loadLevel(idx) {
    const level = LevelRegistry[idx];
    if (!level) return;

    currentLevelIdx = idx;
    Progress.setCurrent(idx);
    gameId++;
    state = PongEngine.create(level);
    keyDir = 0;
    setStatus('status_play');
    updateLevelInfo();
    draw();
    if (ticker) clearInterval(ticker);
    ticker = setInterval(tick, TICK_MS);
}

function tick() {
    if (!state || state.winner !== null) return;
    const dt = TICK_MS / 1000;
    if (keyDir) PongEngine.movePaddle(state, 'player', state.player.y + keyDir * PADDLE_SPEED * dt);
    PongEngine.aiMove(state, document.getElementById('difficulty').value, dt);
    const events = PongEngine.step(state, dt);
    draw();
    if (events.includes('won')) {
        setStatus('win');
        Progress.markSolved(currentLevelIdx);
        const winGameId = gameId;
        setTimeout(() => { if (winGameId === gameId) nextLevel(); }, 2000);
    } else if (events.includes('lost')) {
        setStatus('lose');
    } else if (events.includes('player_point')) {
        setStatus('status_point_you');
    } else if (events.includes('ai_point')) {
        setStatus('status_point_ai');
    }
}

function draw() {
    const { WIDTH, HEIGHT, PADDLE_W, PADDLE_X, BALL_R } = PongEngine;
    ctx.fillStyle = '#0d0b14';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.setLineDash([8, 8]);
    ctx.beginPath(); ctx.moveTo(WIDTH / 2, 0); ctx.lineTo(WIDTH / 2, HEIGHT); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(state.score[0], WIDTH / 2 - 50, 48);
    ctx.fillText(state.score[1], WIDTH / 2 + 50, 48);
    ctx.fillStyle = '#3b6fe0';
    ctx.fillRect(PADDLE_X, state.player.y - state.paddleH / 2, PADDLE_W, state.paddleH);
    ctx.fillStyle = '#d64545';
    ctx.fillRect(WIDTH - PADDLE_X - PADDLE_W, state.ai.y - state.paddleH / 2, PADDLE_W, state.paddleH);
    ctx.fillStyle = '#f5b301';
    ctx.beginPath(); ctx.arc(state.ball.x, state.ball.y, BALL_R, 0, Math.PI * 2); ctx.fill();
    countersEl.innerText = `${i18n.t('target')}: ${state.target} · ${i18n.t('rally')}: ${state.hits}`;
}

function canvasY(event) {
    const rect = canvas.getBoundingClientRect();
    return ((event.clientY - rect.top) / rect.height) * PongEngine.HEIGHT;
}

canvas.addEventListener('pointermove', (event) => { if (state) PongEngine.movePaddle(state, 'player', canvasY(event)); });
canvas.addEventListener('pointerdown', (event) => { if (state) PongEngine.movePaddle(state, 'player', canvasY(event)); });

document.addEventListener('keydown', (event) => {
    const inFormControl = event.target instanceof Element && event.target.closest('select, input');
    if (inFormControl || document.querySelector('.modal.active')) return;
    if (event.key === 'ArrowUp' || event.key.toLowerCase() === 'w') keyDir = -1;
    else if (event.key === 'ArrowDown' || event.key.toLowerCase() === 's') keyDir = 1;
    else if (event.key.toLowerCase() === 'r') loadLevel(currentLevelIdx);
    else return;
    event.preventDefault();
});
document.addEventListener('keyup', (event) => {
    if ((event.key === 'ArrowUp' || event.key.toLowerCase() === 'w') && keyDir < 0) keyDir = 0;
    if ((event.key === 'ArrowDown' || event.key.toLowerCase() === 's') && keyDir > 0) keyDir = 0;
});

document.querySelectorAll('.pad button[data-dir]').forEach(btn => {
    const dir = Number(btn.dataset.dir);
    btn.addEventListener('pointerdown', (event) => { event.preventDefault(); keyDir = dir; });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(type => btn.addEventListener(type, () => { if (keyDir === dir) keyDir = 0; }));
});

function nextLevel() {
    if (currentLevelIdx + 1 < LevelRegistry.length) loadLevel(currentLevelIdx + 1);
    else setStatus('all_levels_cleared');
}

function setStatus(key) {
    statusKey = key;
    statusEl.innerText = i18n.t(key);
}

function updateLevelInfo() {
    const level = LevelRegistry[currentLevelIdx];
    levelInfoEl.innerText = `${i18n.t('level')} ${currentLevelIdx + 1}/${LevelRegistry.length}: ${level.name}`;
}

document.getElementById('restartBtn').onclick = () => loadLevel(currentLevelIdx);
window.addEventListener('langChanged', () => { setStatus(statusKey); updateLevelInfo(); draw(); });

if (LevelRegistry.length > 0) loadLevel(Progress.startLevel());
