const TICK_MS = 150;
const SWIPE_MIN = 24;

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
    state = BombEngine.create(level);
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
    BombEngine.step(state, action);
    render();
    if (state.cleared) {
        setStatus('status_solved');
        Progress.markSolved(currentLevelIdx);
        const solvedLevelIdx = currentLevelIdx;
        setTimeout(() => { if (solvedLevelIdx === currentLevelIdx) nextLevel(); }, 1800);
    } else if (state.dead) {
        setStatus('status_dead');
    }
}

function render() {
    board.style.gridTemplateColumns = `repeat(${state.width}, 1fr)`;
    board.style.maxWidth = `${state.width * 36}px`;
    const enemies = new Set(state.enemies.map(e => `${e.r},${e.c}`));
    const bombs = new Set(state.bombs.map(b => `${b.r},${b.c}`));
    const cells = [];
    for (let r = 0; r < state.height; r++) {
        for (let c = 0; c < state.width; c++) {
            const key = `${r},${c}`;
            const ch = state.cells[r][c];
            const classes = ['cell', ch === '#' ? 'wall' : ch === 'B' ? 'brick' : 'floor',
                state.exitOpen && state.exit[0] === r && state.exit[1] === c ? (state.enemies.length ? 'exit' : 'exit open') : '',
                bombs.has(key) ? 'bomb' : '', state.flames.has(key) ? 'flame' : '',
                enemies.has(key) ? 'enemy' : '',
                state.player[0] === r && state.player[1] === c ? `player ${state.dead ? 'dead' : ''}` : ''].join(' ');
            cells.push(`<div class="${classes}"></div>`);
        }
    }
    board.innerHTML = cells.join('');
    countersEl.innerText = `${i18n.t('enemies')}: ${state.enemies.length} · ${i18n.t('bombs')}: ${state.maxBombs - state.bombs.length}/${state.maxBombs}` + (state.exitOpen ? ` · ${i18n.t('exit_found')}` : '');
}

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

const KEYS = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right' };

document.addEventListener('keydown', (event) => {
    const inFormControl = event.target instanceof Element && event.target.closest('select, input');
    if (inFormControl || document.querySelector('.modal.active')) return;
    const dir = KEYS[event.key] ?? KEYS[event.key.toLowerCase()];
    if (dir) {
        if (heldDir !== dir) pendingAction = dir;
        heldDir = dir;
    } else if (event.key === ' ' || event.key.toLowerCase() === 'b') {
        pendingAction = 'bomb';
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
document.getElementById('bombBtn').addEventListener('pointerdown', (event) => { event.preventDefault(); pendingAction = 'bomb'; });

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
    if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_MIN) { pendingAction = 'bomb'; return; }
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
