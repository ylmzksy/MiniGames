const SWIPE_MIN = 24;

let currentLevelIdx = 0;
let state = null;
let ticker = null;
let pendingDir = null;
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
    state = TronEngine.create(level);
    pendingDir = null;
    setStatus('status_play');
    updateLevelInfo();
    render();
    if (ticker) clearInterval(ticker);
    ticker = setInterval(tick, level.tickMs);
}

function tick() {
    if (!state || state.over) return;
    const difficulty = document.getElementById('difficulty').value;
    TronEngine.step(state, pendingDir, difficulty);
    pendingDir = null;
    render();
    if (!state.over) return;
    if (state.winner === 'player') {
        setStatus('win');
        Progress.markSolved(currentLevelIdx);
        const winLevelIdx = currentLevelIdx;
        setTimeout(() => { if (winLevelIdx === currentLevelIdx) nextLevel(); }, 2000);
    } else {
        setStatus(state.winner === 'draw' ? 'draw' : 'lose');
    }
}

function render() {
    board.style.gridTemplateColumns = `repeat(${state.width}, 1fr)`;
    board.style.maxWidth = `${state.width * 20}px`;
    const cells = [];
    for (let r = 0; r < state.height; r++) {
        for (let c = 0; c < state.width; c++) {
            const v = state.grid[r][c];
            const classes = ['cell', v === 1 ? 'blue' : v === 2 ? 'red' : '',
                state.player.r === r && state.player.c === c ? 'head' : '',
                state.ai.r === r && state.ai.c === c ? 'head' : ''].join(' ');
            cells.push(`<div class="${classes}"></div>`);
        }
    }
    board.innerHTML = cells.join('');
    countersEl.innerText = `${i18n.t('ticks')}: ${state.ticks}`;
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
    levelInfoEl.innerText = `${i18n.t('level')} ${currentLevelIdx + 1}/${LevelRegistry.length}: ${level.name} (${level.width}×${level.height})`;
}

const KEYS = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right' };

window.steer = (dir) => { pendingDir = dir; };

document.addEventListener('keydown', (event) => {
    const inFormControl = event.target instanceof Element && event.target.closest('select, input');
    if (inFormControl || document.querySelector('.modal.active')) return;
    const dir = KEYS[event.key] ?? KEYS[event.key.toLowerCase()];
    if (dir) steer(dir);
    else if (event.key.toLowerCase() === 'r') loadLevel(currentLevelIdx);
    else return;
    event.preventDefault();
});

document.querySelectorAll('.dpad button[data-dir]').forEach(btn => {
    btn.addEventListener('pointerdown', (event) => { event.preventDefault(); steer(btn.dataset.dir); });
});

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
    steer(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
});

document.getElementById('restartBtn').onclick = () => loadLevel(currentLevelIdx);

window.addEventListener('langChanged', () => {
    setStatus(statusKey);
    updateLevelInfo();
});

// Initial Load
if (LevelRegistry.length > 0) loadLevel(Progress.startLevel());
