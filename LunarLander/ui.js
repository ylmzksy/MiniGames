const TICK_MS = 1000 / 30;

let currentLevelIdx = 0;
let state = null;
let ticker = null;
let input = { left: false, right: false, thrust: false };
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
    state = LanderEngine.create(level);
    input = { left: false, right: false, thrust: false };
    setStatus('status_play');
    updateLevelInfo();
    draw();
    if (ticker) clearInterval(ticker);
    ticker = setInterval(tick, TICK_MS);
}

function tick() {
    if (!state || state.result) return;
    LanderEngine.step(state, input);
    draw();
    if (state.result) finish();
}

function finish() {
    clearInterval(ticker);
    ticker = null;
    if (state.result.type === 'landed') {
        setStatus('status_landed', { mult: state.result.pad.mult, fuel: Math.round(state.lander.fuel) });
        Progress.markSolved(currentLevelIdx);
        const solvedLevelIdx = currentLevelIdx;
        setTimeout(() => {
            if (solvedLevelIdx === currentLevelIdx && state.result) nextLevel();
        }, 2200);
    } else {
        setStatus('status_crashed');
    }
}

function draw() {
    const { WIDTH, HEIGHT } = LanderEngine;
    ctx.fillStyle = '#05070f';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    // stars
    ctx.fillStyle = '#9aa6bd';
    for (let i = 0; i < 40; i++) ctx.fillRect((i * 97) % WIDTH, (i * 61) % (HEIGHT - 120), 2, 2);
    // terrain
    ctx.beginPath();
    ctx.moveTo(0, HEIGHT);
    state.ground.forEach((y, x) => ctx.lineTo(x, y));
    ctx.lineTo(WIDTH, HEIGHT);
    ctx.closePath();
    ctx.fillStyle = '#3a3f52';
    ctx.fill();
    ctx.strokeStyle = '#8a94a6';
    ctx.lineWidth = 2;
    ctx.beginPath();
    state.ground.forEach((y, x) => x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y));
    ctx.stroke();
    // pads
    state.pads.forEach(p => {
        ctx.fillStyle = '#34c77b';
        ctx.fillRect(p.x1, p.y - 2, p.x2 - p.x1, 4);
        ctx.fillStyle = '#e8ecf4';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`×${p.mult}`, (p.x1 + p.x2) / 2, p.y + 16);
    });
    drawLander();
}

function drawLander() {
    const l = state.lander;
    ctx.save();
    ctx.translate(l.x, l.y);
    ctx.rotate(l.angle);
    if (state.thrusting) {
        ctx.fillStyle = '#f5b301';
        ctx.beginPath(); ctx.moveTo(-5, 10); ctx.lineTo(5, 10); ctx.lineTo(0, 22 + Math.random() * 8); ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = state.result?.type === 'crashed' ? '#d64545' : '#e8ecf4';
    ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(10, 4); ctx.lineTo(-10, 4); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#5b8cff';
    ctx.fillRect(-9, 4, 18, 6);
    ctx.strokeStyle = '#e8ecf4';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-8, 10); ctx.lineTo(-LanderEngine.FOOT, 12); ctx.moveTo(8, 10); ctx.lineTo(LanderEngine.FOOT, 12); ctx.stroke();
    ctx.restore();

    const l2 = state.lander;
    const alt = Math.max(0, Math.round(LanderEngine.groundAt(state, l2.x) - (l2.y + 12)));
    const ok = v => Math.abs(v) <= LanderEngine.MAX_VY;
    hudEl.innerHTML = `
        <span>${i18n.t('fuel')}: <b>${Math.round(l2.fuel)}</b></span>
        <span>${i18n.t('altitude')}: <b>${alt}</b></span>
        <span class="${Math.abs(l2.vx) <= LanderEngine.MAX_VX ? 'ok' : 'bad'}">${i18n.t('speed_x')}: <b>${Math.round(l2.vx)}</b></span>
        <span class="${ok(l2.vy) ? 'ok' : 'bad'}">${i18n.t('speed_y')}: <b>${Math.round(l2.vy)}</b></span>
        <span class="${Math.abs(l2.angle) <= LanderEngine.MAX_TILT ? 'ok' : 'bad'}">${i18n.t('tilt')}: <b>${Math.round(l2.angle * 180 / Math.PI)}°</b></span>`;
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

const KEYS = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'thrust', ' ': 'thrust', a: 'left', d: 'right', w: 'thrust' };

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
    setStatus(statusKey);
    updateLevelInfo();
    draw();
});

// Initial Load
if (LevelRegistry.length > 0) loadLevel(Progress.startLevel());
