const SWIPE_MIN = 24;

let currentLevelIdx = 0;
let state = null;
let ticker = null;
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
    state = SnakeEngine.create(level);
    setStatus('status_play');
    updateLevelInfo();
    render();
    if (ticker) clearInterval(ticker);
    ticker = setInterval(tick, level.tickMs);
}

function tick() {
    if (!state || state.dead || state.cleared) return;
    SnakeEngine.step(state);
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
    board.style.maxWidth = `${state.width * 26}px`;
    const body = new Map(state.snake.map(([r, c], i) => [`${r},${c}`, i]));
    const cells = [];
    for (let r = 0; r < state.height; r++) {
        for (let c = 0; c < state.width; c++) {
            const key = `${r},${c}`;
            const idx = body.get(key);
            const classes = ['cell', state.walls.has(key) ? 'wall' : '',
                idx === 0 ? `head ${state.dir} ${state.dead ? 'dead' : ''}` : idx !== undefined ? 'body' : '',
                state.food && state.food[0] === r && state.food[1] === c ? 'food' : ''].join(' ');
            cells.push(`<div class="${classes}"></div>`);
        }
    }
    board.innerHTML = cells.join('');
    countersEl.innerText = `${i18n.t('length')}: ${state.snake.length}/${state.target}`;
}

function nextLevel() {
    if (currentLevelIdx + 1 < LevelRegistry.length) loadLevel(currentLevelIdx + 1);
    else setStatus('all_levels_cleared');
}

function setStatus(key) {
    statusKey = key;
    statusEl.innerText = i18n.t(key, { target: state ? state.target : '' });
}

function updateLevelInfo() {
    const level = LevelRegistry[currentLevelIdx];
    levelInfoEl.innerText = `${i18n.t('level')} ${currentLevelIdx + 1}/${LevelRegistry.length}: ${level.name}`;
}

const KEYS = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right' };

window.steer = (dir) => { if (state) SnakeEngine.turn(state, dir); };

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
    render();
});

// Initial Load
if (LevelRegistry.length > 0) loadLevel(Progress.startLevel());
