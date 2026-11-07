const TICK_MS = 1000 / 30;

let currentLevelIdx = 0;
let state = null;
let ticker = null;
let input = { left: false, right: false, thrust: false, fire: false };
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
    state = AsteroidsEngine.create(level);
    input = { left: false, right: false, thrust: false, fire: false };
    setStatus('status_play');
    updateLevelInfo();
    draw();
    if (ticker) clearInterval(ticker);
    ticker = setInterval(tick, TICK_MS);
}

function tick() {
    if (!state || state.result) return;
    AsteroidsEngine.step(state, input);
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

function draw() {
    const { WIDTH, HEIGHT } = AsteroidsEngine;
    ctx.fillStyle = '#05070f';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = '#5b6577';
    for (let i = 0; i < 50; i++) ctx.fillRect((i * 131) % WIDTH, (i * 71) % HEIGHT, 1.5, 1.5);

    ctx.strokeStyle = '#c9ced8';
    ctx.lineWidth = 2;
    state.asteroids.forEach(a => {
        ctx.save();
        ctx.translate(a.x, a.y);
        ctx.rotate(a.rot);
        ctx.beginPath();
        a.shape.forEach((k, i) => {
            const t = (i / a.shape.length) * Math.PI * 2;
            const px = Math.cos(t) * a.r * k;
            const py = Math.sin(t) * a.r * k;
            i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        });
        ctx.closePath();
        ctx.stroke();
        ctx.restore();
    });

    ctx.fillStyle = '#ffffff';
    state.bullets.forEach(b => { ctx.beginPath(); ctx.arc(b.x, b.y, 2.5, 0, Math.PI * 2); ctx.fill(); });

    const s = state.ship;
    if (state.result !== 'lost') {
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate(s.angle);
        ctx.globalAlpha = s.invulnerable > 0 && Math.floor(s.invulnerable * 8) % 2 ? 0.35 : 1;
        if (s.thrusting) {
            ctx.strokeStyle = '#f5b301';
            ctx.beginPath(); ctx.moveTo(-8, -5); ctx.lineTo(-18 - Math.random() * 6, 0); ctx.lineTo(-8, 5); ctx.stroke();
        }
        ctx.strokeStyle = '#5b8cff';
        ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-10, -9); ctx.lineTo(-6, 0); ctx.lineTo(-10, 9); ctx.closePath(); ctx.stroke();
        ctx.restore();
    }
    hudEl.innerText = `${i18n.t('lives')}: ${'▲'.repeat(Math.max(0, state.lives))} · ${i18n.t('score')}: ${state.score} · ${i18n.t('asteroids')}: ${state.asteroids.length}`;
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

const KEYS = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'thrust', ' ': 'fire', a: 'left', d: 'right', w: 'thrust', f: 'fire' };

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
