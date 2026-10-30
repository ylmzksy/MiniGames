const TICK_MS = 160;
const SWIPE_MIN = 24;
const TILE = { '#': 'wall', '.': 'dirt', ' ': 'space', 'O': 'boulder', '*': 'diamond', 'R': 'player', 'X': 'exit' };

let currentLevelIdx = 0;
let state = null;
let ticker = null;
let heldDir = null;     // direction held on the keyboard or pad
let pendingDir = null;  // a single queued move (swipe or tap)
let ticks = 0;
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
    state = BoulderEngine.parse(level);
    heldDir = null;
    pendingDir = null;
    ticks = 0;
    setStatus('status_play');
    updateLevelInfo();
    render();
    if (ticker) clearInterval(ticker);
    ticker = setInterval(tick, TICK_MS);
}

function tick() {
    if (!state || state.dead || state.exited) return;
    const dir = pendingDir || heldDir;
    pendingDir = null;
    BoulderEngine.step(state, dir);
    ticks++;
    render();
    if (state.exited) {
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
    board.style.maxWidth = `${state.width * 40}px`;
    const open = BoulderEngine.isOpen(state);
    const cells = [];
    for (let r = 0; r < state.height; r++) {
        for (let c = 0; c < state.width; c++) {
            const ch = state.cells[r][c];
            const classes = ['cell', TILE[ch] || 'space',
                ch === 'X' && open ? 'open' : '',
                state.falling.has(`${r},${c}`) ? 'falling' : '',
                ch === 'R' && state.dead ? 'dead' : ''].join(' ');
            cells.push(`<div class="${classes}"></div>`);
        }
    }
    board.innerHTML = cells.join('');
    countersEl.innerText = `${i18n.t('diamonds')}: ${state.collected}/${state.needed}` + (open ? ` · ${i18n.t('exit_open')}` : '');
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
        if (heldDir !== dir) pendingDir = dir; // a fresh press moves at once on the next tick
        heldDir = dir;
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

// On-screen pad: hold to keep moving
document.querySelectorAll('.dpad button').forEach(btn => {
    const dir = btn.dataset.dir;
    btn.addEventListener('pointerdown', (event) => { event.preventDefault(); pendingDir = dir; heldDir = dir; });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(type => btn.addEventListener(type, () => { if (heldDir === dir) heldDir = null; }));
});

// Swiping on the board moves one step
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
    if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_MIN) return;
    pendingDir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
});

document.getElementById('restartBtn').onclick = () => loadLevel(currentLevelIdx);

window.addEventListener('langChanged', () => {
    setStatus(statusKey);
    updateLevelInfo();
    render();
});

// Initial Load
if (LevelRegistry.length > 0) loadLevel(Progress.startLevel());
