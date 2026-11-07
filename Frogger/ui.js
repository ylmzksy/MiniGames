const TICK_MS = 1000 / 30;
const CELL = 40;
const SWIPE_MIN = 24;

let currentLevelIdx = 0;
let state = null;
let ticker = null;
let statusKey = 'status_play';

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const levelInfoEl = document.getElementById('level-info');
const hudEl = document.getElementById('hud');

function loadLevel(idx) {
    const level = LevelRegistry[idx];
    if (!level) return;

    currentLevelIdx = idx;
    Progress.setCurrent(idx);
    state = FroggerEngine.create(level);
    canvas.width = FroggerEngine.COLS * CELL;
    canvas.height = state.rows * CELL;
    setStatus('status_play');
    updateLevelInfo();
    draw();
    if (ticker) clearInterval(ticker);
    ticker = setInterval(tick, TICK_MS);
}

function tick() {
    if (!state || state.result) return;
    const livesBefore = state.lives;
    FroggerEngine.step(state);
    if (state.lives < livesBefore && !state.result) setStatus('status_' + state.lastDeath);
    draw();
    if (state.result) finish();
}

window.hop = (dir) => {
    if (!state || state.result) return;
    const homesBefore = state.homes.filter(Boolean).length;
    const livesBefore = state.lives;
    FroggerEngine.hop(state, dir);
    if (state.homes.filter(Boolean).length > homesBefore && !state.result) setStatus('status_home');
    if (state.lives < livesBefore && !state.result) setStatus('status_' + state.lastDeath);
    draw();
    if (state.result) finish();
};

function finish() {
    clearInterval(ticker);
    ticker = null;
    if (state.result === 'won') {
        setStatus('status_won');
        Progress.markSolved(currentLevelIdx);
        const solvedLevelIdx = currentLevelIdx;
        setTimeout(() => {
            if (solvedLevelIdx === currentLevelIdx && state.result) nextLevel();
        }, 2000);
    } else {
        setStatus('status_lost');
    }
}

function draw() {
    const E = FroggerEngine;
    const W = E.COLS * CELL;
    for (let r = 0; r < state.rows; r++) {
        const lane = E.laneAt(state, r);
        ctx.fillStyle = r === 0 ? '#1f5a2b' : lane ? (lane.type === 'river' ? '#1d4ed8' : '#2b2f3a') : '#4a7a3a';
        ctx.fillRect(0, r * CELL, W, CELL);
        if (lane && lane.type === 'road') { ctx.fillStyle = '#e8ecf4'; for (let x = 0; x < W; x += 30) ctx.fillRect(x, r * CELL + CELL / 2 - 1, 16, 2); }
    }
    // homes
    E.HOMES.forEach((c, i) => {
        ctx.fillStyle = '#0b2a14';
        ctx.fillRect(c * CELL + 2, 2, CELL - 4, CELL - 4);
        if (state.homes[i]) drawFrog(c * CELL + CELL / 2, CELL / 2, '#34c77b');
    });
    // lane objects
    state.lanes.forEach(lane => {
        E.spans(lane, state.time).forEach(([a, b]) => {
            const x = a * CELL, w = (b - a) * CELL, y = lane.row * CELL;
            if (x + w < 0 || x > W) return;
            if (lane.kind === 'log') { ctx.fillStyle = '#8a5a2b'; ctx.beginPath(); ctx.roundRect(x + 2, y + 8, w - 4, CELL - 16, 10); ctx.fill(); }
            else if (lane.kind === 'turtle') { ctx.fillStyle = '#2f9e44'; for (let k = a; k < b; k++) { ctx.beginPath(); ctx.arc(k * CELL + CELL / 2, y + CELL / 2, CELL / 2 - 6, 0, Math.PI * 2); ctx.fill(); } }
            else { ctx.fillStyle = lane.color; ctx.beginPath(); ctx.roundRect(x + 3, y + 7, w - 6, CELL - 14, 6); ctx.fill(); ctx.fillStyle = '#05070f'; ctx.fillRect(x + 8, y + 10, 6, 4); ctx.fillRect(x + w - 14, y + 10, 6, 4); }
        });
    });
    if (state.frog.alive) drawFrog(state.frog.x * CELL + CELL / 2, state.frog.row * CELL + CELL / 2, '#7fd36b');
    else { ctx.fillStyle = '#d64545'; ctx.font = '26px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('✕', state.frog.x * CELL + CELL / 2, state.frog.row * CELL + CELL / 2 + 9); }
    hudEl.innerText = `${i18n.t('lives')}: ${'🐸'.repeat(Math.max(0, state.lives))} · ${i18n.t('homes')}: ${state.homes.filter(Boolean).length}/${state.needed}`;
}

function drawFrog(x, y, color) {
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.ellipse(x, y, 14, 11, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(x - 6, y - 7, 4, 0, Math.PI * 2); ctx.arc(x + 6, y - 7, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#05070f';
    ctx.beginPath(); ctx.arc(x - 6, y - 7, 2, 0, Math.PI * 2); ctx.arc(x + 6, y - 7, 2, 0, Math.PI * 2); ctx.fill();
}

function nextLevel() {
    if (currentLevelIdx + 1 < LevelRegistry.length) {
        loadLevel(currentLevelIdx + 1);
    } else {
        setStatus('all_levels_cleared');
    }
}

function setStatus(key) {
    statusKey = key;
    statusEl.innerText = i18n.t(key);
}

function updateLevelInfo() {
    const level = LevelRegistry[currentLevelIdx];
    levelInfoEl.innerText = `${i18n.t('level')} ${currentLevelIdx + 1}/${LevelRegistry.length}: ${level.name}`;
}

const KEYS = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right' };

document.addEventListener('keydown', (event) => {
    if (document.querySelector('.modal.active')) return;
    const dir = KEYS[event.key] ?? KEYS[event.key.toLowerCase()];
    if (dir) { hop(dir); event.preventDefault(); }
    else if (event.key.toLowerCase() === 'r') { loadLevel(currentLevelIdx); event.preventDefault(); }
});

let touchStart = null;
canvas.addEventListener('touchstart', (event) => { const t = event.changedTouches[0]; touchStart = [t.clientX, t.clientY]; }, { passive: true });
canvas.addEventListener('touchend', (event) => {
    if (!touchStart) return;
    const t = event.changedTouches[0];
    const dx = t.clientX - touchStart[0], dy = t.clientY - touchStart[1];
    touchStart = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_MIN) return;
    hop(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
});

document.getElementById('restartBtn').onclick = () => loadLevel(currentLevelIdx);

window.addEventListener('langChanged', () => {
    setStatus(statusKey);
    updateLevelInfo();
    draw();
});

// Initial Load
if (LevelRegistry.length > 0) loadLevel(Progress.startLevel());
