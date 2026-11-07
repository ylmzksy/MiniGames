const TICK_MS = 16;
const PADDLE_SPEED = 420; // px/s with the keys

let currentLevelIdx = 0;
let state = null;
let ticker = null;
let keyDir = 0;
let statusKey = 'status_play';

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
    state = BreakoutEngine.create(level);
    keyDir = 0;
    setStatus('status_play');
    updateLevelInfo();
    draw();
    if (ticker) clearInterval(ticker);
    ticker = setInterval(tick, TICK_MS);
}

function tick() {
    if (!state || state.won || state.lost) return;
    if (keyDir) BreakoutEngine.movePaddle(state, state.paddle.x + keyDir * PADDLE_SPEED * TICK_MS / 1000);
    const events = BreakoutEngine.step(state, TICK_MS / 1000);
    draw();
    if (events.includes('won')) {
        setStatus('status_won');
        Progress.markSolved(currentLevelIdx);
        const solvedLevelIdx = currentLevelIdx;
        setTimeout(() => { if (solvedLevelIdx === currentLevelIdx) nextLevel(); }, 1800);
    } else if (events.includes('lost')) {
        setStatus('status_lost');
    } else if (events.includes('life')) {
        setStatus('status_life');
    }
}

function draw() {
    const { WIDTH, HEIGHT, PADDLE_Y, PADDLE_H, BALL_R } = BreakoutEngine;
    ctx.fillStyle = '#0d0b14';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    state.bricks.forEach(b => {
        if (b.hp <= 0) return;
        ctx.fillStyle = b.color;
        ctx.globalAlpha = b.hp >= 3 ? 1 : b.hp === 2 ? 0.85 : 0.7;
        ctx.fillRect(b.x, b.y, b.w, b.h);
        ctx.globalAlpha = 1;
        if (b.hp > 1) { ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(b.hp, b.x + b.w / 2, b.y + 13); }
    });
    ctx.fillStyle = '#e8ecf4';
    ctx.beginPath(); ctx.roundRect(state.paddle.x - state.paddle.w / 2, PADDLE_Y, state.paddle.w, PADDLE_H, 5); ctx.fill();
    ctx.fillStyle = '#f5b301';
    ctx.beginPath(); ctx.arc(state.ball.x, state.ball.y, BALL_R, 0, Math.PI * 2); ctx.fill();
    countersEl.innerText = `${i18n.t('score')}: ${state.score} · ${i18n.t('lives')}: ${'●'.repeat(state.lives)} · ${i18n.t('bricks')}: ${state.bricks.filter(b => b.hp > 0).length}`;
}

function canvasX(event) {
    const rect = canvas.getBoundingClientRect();
    return ((event.clientX - rect.left) / rect.width) * BreakoutEngine.WIDTH;
}

canvas.addEventListener('pointermove', (event) => { if (state) BreakoutEngine.movePaddle(state, canvasX(event)); });
canvas.addEventListener('pointerdown', (event) => { if (!state) return; BreakoutEngine.movePaddle(state, canvasX(event)); BreakoutEngine.launch(state); });

window.launchBall = () => { if (state) BreakoutEngine.launch(state); };

document.addEventListener('keydown', (event) => {
    const inFormControl = event.target instanceof Element && event.target.closest('select, input');
    if (inFormControl || document.querySelector('.modal.active')) return;
    if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a') keyDir = -1;
    else if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'd') keyDir = 1;
    else if (event.key === ' ' || event.key === 'ArrowUp') launchBall();
    else if (event.key.toLowerCase() === 'r') loadLevel(currentLevelIdx);
    else return;
    event.preventDefault();
});
document.addEventListener('keyup', (event) => {
    if ((event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a') && keyDir < 0) keyDir = 0;
    if ((event.key === 'ArrowRight' || event.key.toLowerCase() === 'd') && keyDir > 0) keyDir = 0;
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
