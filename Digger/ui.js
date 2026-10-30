const TICK_MS = 150;
const SWIPE_MIN = 24;
const TILE = { '#': 'wall', '.': 'dirt', ' ': 'tunnel', '*': 'emerald', 'B': 'bag', '$': 'gold' };

let currentLevelIdx = 0;
let state = null;
let ticker = null;
let heldDir = null;
let pendingAction = null;
let statusKey = 'status_play';

const board = document.getElementById('game-board');
const statusEl = document.getElementById('status');
const levelInfoEl = document.getElementById('level-info');
const countersEl = document.getElementById('counters');

function loadLevel(idx) {
    const level = LevelRegistry[idx];
    if (!level) return;

    currentLevelIdx = idx;
    Progress.setCurrent(idx);
    state = DiggerEngine.parse(level);
    heldDir = null;
    pendingAction = null;
    setStatus('status_play');
    updateLevelInfo();
    render();
    if (ticker) clearInterval(ticker);
    ticker = setInterval(tick, TICK_MS);
}

function tick() {
    if (!state || state.dead || state.cleared) return;
    const action = pendingAction || heldDir;
    pendingAction = null;
    DiggerEngine.step(state, action);
    render();
    if (state.cleared) {
        setStatus('status_solved');
        Progress.markSolved(currentLevelIdx);
        const solvedLevelIdx = currentLevelIdx;
        setTimeout(() => {
            if (solvedLevelIdx === currentLevelIdx) nextLevel();
        }, 1800);
    } else if (state.dead) {
        setStatus('status_dead');
    }
}

function render() {
    board.style.gridTemplateColumns = `repeat(${state.width}, 1fr)`;
    board.style.maxWidth = `${state.width * 36}px`;
    const monsters = new Set(state.monsters.map(m => `${m[0]},${m[1]}`));
    const cells = [];
    for (let r = 0; r < state.height; r++) {
        for (let c = 0; c < state.width; c++) {
            const key = `${r},${c}`;
            const ch = state.cells[r][c];
            const classes = ['cell', TILE[ch] || 'tunnel',
                state.den[0] === r && state.den[1] === c ? 'den' : '',
                state.falling.has(key) ? 'falling' : '',
                monsters.has(key) ? 'monster' : '',
                state.player[0] === r && state.player[1] === c ? `digger ${state.facing} ${state.dead ? 'dead' : ''}` : '',
                state.bullet && state.bullet.r === r && state.bullet.c === c ? 'bullet' : ''].join(' ');
            cells.push(`<div class="${classes}"></div>`);
        }
    }
    board.innerHTML = cells.join('');
    const left = DiggerEngine.emeraldsLeft(state);
    countersEl.innerText = `${i18n.t('emeralds')}: ${left} · ${i18n.t('score')}: ${state.score} · ${i18n.t('monsters')}: ${state.monsters.length}${state.toSpawn ? ` (+${state.toSpawn})` : ''}`;
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
    const inFormControl = event.target instanceof Element && event.target.closest('select, input');
    if (inFormControl || document.querySelector('.modal.active')) return;
    const dir = KEYS[event.key] ?? KEYS[event.key.toLowerCase()];
    if (dir) {
        if (heldDir !== dir) pendingAction = dir;
        heldDir = dir;
    } else if (event.key === ' ' || event.key.toLowerCase() === 'f') {
        pendingAction = 'fire';
    } else if (event.key.toLowerCase() === 'r') {
        loadLevel(currentLevelIdx);
    } else {
        return;
    }
    event.preventDefault();
});

document.addEventListener('keyup', (event) => {
    const dir = KEYS[event.key] ?? KEYS[event.key.toLowerCase()];
    if (dir && heldDir === dir) heldDir = null;
});

document.querySelectorAll('.dpad button[data-dir]').forEach(btn => {
    const dir = btn.dataset.dir;
    btn.addEventListener('pointerdown', (event) => { event.preventDefault(); pendingAction = dir; heldDir = dir; });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(type => btn.addEventListener(type, () => { if (heldDir === dir) heldDir = null; }));
});
document.getElementById('fireBtn').addEventListener('pointerdown', (event) => { event.preventDefault(); pendingAction = 'fire'; });

let touchStart = null;
board.addEventListener('touchstart', (event) => {
    const touch = event.changedTouches[0];
    touchStart = [touch.clientX, touch.clientY];
}, { passive: true });

board.addEventListener('touchend', (event) => {
    if (!touchStart) return;
    const touch = event.changedTouches[0];
    const dx = touch.clientX - touchStart[0];
    const dy = touch.clientY - touchStart[1];
    touchStart = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_MIN) { pendingAction = 'fire'; return; }
    pendingAction = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
});

document.getElementById('restartBtn').onclick = () => loadLevel(currentLevelIdx);

window.addEventListener('langChanged', () => {
    setStatus(statusKey);
    updateLevelInfo();
    render();
});

// Initial Load
if (LevelRegistry.length > 0) loadLevel(Progress.startLevel());
