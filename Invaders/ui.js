const TICK_MS = 1000 / 30;

let currentLevelIdx = 0;
let state = null;
let ticker = null;
let input = { left: false, right: false, fire: false };
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
    state = InvadersEngine.create(level);
    input = { left: false, right: false, fire: false };
    setStatus('status_play');
    updateLevelInfo();
    draw();
    if (ticker) clearInterval(ticker);
    ticker = setInterval(tick, TICK_MS);
}

function tick() {
    if (!state || state.result) return;
    InvadersEngine.step(state, input);
    draw();
    if (state.result) finish();
}

function finish() {
    clearInterval(ticker);
    ticker = null;
    if (state.result === 'won') {
        setStatus('status_won', { score: state.score });
        Progress.markSolved(currentLevelIdx);
        const solvedLevelIdx = currentLevelIdx;
        setTimeout(() => {
            if (solvedLevelIdx === currentLevelIdx && state.result) nextLevel();
        }, 2000);
    } else {
        setStatus('status_lost');
    }
}

function drawAlien(x, y, kind, frame) {
    const colors = ['#34c77b', '#5b8cff', '#f06ab0'];
    ctx.fillStyle = colors[kind];
    const w = InvadersEngine.ALIEN_W, h = InvadersEngine.ALIEN_H;
    ctx.fillRect(x + 6, y + 2, w - 12, h - 8);
    ctx.fillRect(x + 2, y + 8, w - 4, h - 12);
    ctx.fillRect(x + (frame ? 2 : 6), y + h - 6, 6, 6);
    ctx.fillRect(x + w - (frame ? 8 : 12), y + h - 6, 6, 6);
    ctx.fillStyle = '#05070f';
    ctx.fillRect(x + 9, y + 8, 4, 4);
    ctx.fillRect(x + w - 13, y + 8, 4, 4);
}

function draw() {
    const E = InvadersEngine;
    ctx.fillStyle = '#05070f';
    ctx.fillRect(0, 0, E.WIDTH, E.HEIGHT);
    const frame = Math.floor(state.ox / 12) % 2;
    state.aliens.forEach(a => { if (a.alive) { const r = E.alienRect(state, a); drawAlien(r.x, r.y, a.kind, frame); } });
    ctx.fillStyle = '#34c77b';
    state.shields.forEach(s => ctx.fillRect(s.x, s.y, s.w - 1, s.h - 1));
    // player
    ctx.fillStyle = state.hitFlash > 0 ? '#d64545' : '#e8ecf4';
    const px = state.player.x;
    ctx.fillRect(px - 16, E.PLAYER_Y - 6, 32, 12);
    ctx.fillRect(px - 3, E.PLAYER_Y - 14, 6, 10);
    ctx.fillStyle = '#ffffff';
    if (state.bullet) ctx.fillRect(state.bullet.x - 1, state.bullet.y - 6, 2, 12);
    ctx.fillStyle = '#f5b301';
    state.alienBullets.forEach(b => ctx.fillRect(b.x - 1.5, b.y - 6, 3, 12));
    ctx.fillStyle = '#34c77b';
    ctx.fillRect(0, E.HEIGHT - 4, E.WIDTH, 2);
    hudEl.innerText = `${i18n.t('lives')}: ${'▲'.repeat(Math.max(0, state.lives))} · ${i18n.t('score')}: ${state.score} · ${i18n.t('aliens')}: ${E.alive(state).length}`;
}

function nextLevel() {
    if (currentLevelIdx + 1 < LevelRegistry.length) {
        loadLevel(currentLevelIdx + 1);
    } else {
        setStatus('all_levels_cleared');
    }
}

function setStatus(key, params = {}) {
    statusKey = key;
    statusEl.innerText = i18n.t(key, params);
}

function updateLevelInfo() {
    const level = LevelRegistry[currentLevelIdx];
    levelInfoEl.innerText = `${i18n.t('level')} ${currentLevelIdx + 1}/${LevelRegistry.length}: ${level.name}`;
}

const KEYS = { ArrowLeft: 'left', ArrowRight: 'right', ' ': 'fire', a: 'left', d: 'right', ArrowUp: 'fire', w: 'fire', f: 'fire' };

document.addEventListener('keydown', (event) => {
    if (document.querySelector('.modal.active')) return;
    const k = KEYS[event.key] ?? KEYS[event.key.toLowerCase()];
    if (k) { input[k] = true; event.preventDefault(); }
    else if (event.key.toLowerCase() === 'r') { loadLevel(currentLevelIdx); event.preventDefault(); }
});
document.addEventListener('keyup', (event) => {
    const k = KEYS[event.key] ?? KEYS[event.key.toLowerCase()];
    if (k) input[k] = false;
});

document.querySelectorAll('.pad button[data-input]').forEach(btn => {
    const k = btn.dataset.input;
    btn.addEventListener('pointerdown', (event) => { event.preventDefault(); input[k] = true; });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(type => btn.addEventListener(type, () => { input[k] = false; }));
});

document.getElementById('restartBtn').onclick = () => loadLevel(currentLevelIdx);

window.addEventListener('langChanged', () => {
    setStatus(statusKey, { score: state.score });
    updateLevelInfo();
    draw();
});

// Initial Load
if (LevelRegistry.length > 0) loadLevel(Progress.startLevel());
