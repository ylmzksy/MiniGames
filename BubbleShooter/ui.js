const TICK_MS = 16;
const ROTATE_SPEED = 90; // degrees per second with the keys

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
    state = BubbleEngine.create(level);
    keyDir = 0;
    setStatus('status_play');
    updateLevelInfo();
    draw();
    if (ticker) clearInterval(ticker);
    ticker = setInterval(tick, TICK_MS);
}

function tick() {
    if (!state || state.won || state.lost) return;
    if (keyDir) setAngle(state.angle + keyDir * ROTATE_SPEED * TICK_MS / 1000);
    const events = BubbleEngine.step(state, TICK_MS / 1000);
    if (events.length) draw();
    if (events.includes('won')) {
        setStatus('status_won');
        Progress.markSolved(currentLevelIdx);
        const solvedLevelIdx = currentLevelIdx;
        setTimeout(() => { if (solvedLevelIdx === currentLevelIdx) nextLevel(); }, 1800);
    } else if (events.includes('lost')) {
        setStatus('status_lost');
    } else if (events.includes('push')) {
        setStatus('status_push');
    } else if (events.includes('drop')) {
        setStatus('status_drop');
    } else if (events.includes('snap') && statusKey !== 'status_play') {
        setStatus('status_play');
    }
}

function setAngle(a) {
    state.angle = Math.max(-75, Math.min(75, a));
    draw();
}

function draw() {
    const { WIDTH, HEIGHT, R, SHOOTER_Y, DANGER_Y, COLORS } = BubbleEngine;
    ctx.fillStyle = '#14131a';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    const bubble = (x, y, color) => {
        const g = ctx.createRadialGradient(x - R * 0.35, y - R * 0.35, R * 0.1, x, y, R);
        g.addColorStop(0, '#ffffff');
        g.addColorStop(0.25, color);
        g.addColorStop(1, color);
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(x, y, R - 1, 0, Math.PI * 2); ctx.fill();
    };
    state.grid.forEach((row, r) => row.forEach((v, c) => {
        if (v === null) return;
        const [x, y] = BubbleEngine.cellCenter(state, r, c);
        bubble(x, y, COLORS[v]);
    }));
    ctx.strokeStyle = 'rgba(255,80,80,0.5)';
    ctx.setLineDash([6, 6]);
    ctx.beginPath(); ctx.moveTo(0, DANGER_Y); ctx.lineTo(WIDTH, DANGER_Y); ctx.stroke();
    ctx.setLineDash([]);
    // aim line
    const a = state.angle * Math.PI / 180;
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(WIDTH / 2, SHOOTER_Y); ctx.lineTo(WIDTH / 2 + Math.sin(a) * 90, SHOOTER_Y - Math.cos(a) * 90); ctx.stroke();
    ctx.lineWidth = 1;
    if (state.shot) bubble(state.shot.x, state.shot.y, COLORS[state.shot.color]);
    else bubble(WIDTH / 2, SHOOTER_Y, COLORS[state.next]);
    // the bubble after next, small, at the side
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = COLORS[state.after];
    ctx.beginPath(); ctx.arc(WIDTH / 2 + 50, SHOOTER_Y + 8, R * 0.5, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    const left = state.grid.flat().filter(v => v !== null).length;
    countersEl.innerText = `${i18n.t('bubbles')}: ${left} · ${i18n.t('popped')}: ${state.popped} · ${i18n.t('next_row')}: ${state.pushEvery - (state.shots % state.pushEvery)}`;
}

function aimAt(event) {
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * BubbleEngine.WIDTH;
    const y = ((event.clientY - rect.top) / rect.height) * BubbleEngine.HEIGHT;
    const dx = x - BubbleEngine.WIDTH / 2;
    const dy = BubbleEngine.SHOOTER_Y - y;
    if (dy <= 5) return;
    setAngle(Math.atan2(dx, dy) * 180 / Math.PI);
}

canvas.addEventListener('pointermove', (event) => { if (state && !state.shot) aimAt(event); });
canvas.addEventListener('pointerdown', (event) => { if (!state) return; aimAt(event); fireBubble(); });

window.fireBubble = () => { if (state && BubbleEngine.fire(state, state.angle)) { setStatus('status_play'); draw(); } };

document.addEventListener('keydown', (event) => {
    const inFormControl = event.target instanceof Element && event.target.closest('select, input');
    if (inFormControl || document.querySelector('.modal.active')) return;
    if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a') keyDir = -1;
    else if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'd') keyDir = 1;
    else if (event.key === ' ' || event.key === 'ArrowUp') fireBubble();
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
