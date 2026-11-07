const SWIPE_MIN = 24;

let currentLevelIdx = 0;
let state = null;
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
    state = IceEngine.parse(level);
    setStatus('status_play');
    updateLevelInfo();
    render();
}

function render() {
    board.style.gridTemplateColumns = `repeat(${state.width}, 1fr)`;
    board.style.maxWidth = `${state.width * 44}px`;
    const cells = [];
    for (let r = 0; r < state.height; r++) {
        for (let c = 0; c < state.width; c++) {
            const ch = state.cells[r][c];
            const kind = ch === '#' ? 'wall' : ch === ':' ? 'rough' : ch === '*' ? 'gem' : ch === 'X' ? (state.gemsLeft ? 'exit locked' : 'exit') : 'ice';
            const here = state.player[0] === r && state.player[1] === c;
            cells.push(`<div class="cell ${kind} ${here ? 'player' : ''} ${state.exited && here ? 'done' : ''}"></div>`);
        }
    }
    board.innerHTML = cells.join('');
    countersEl.innerText = `${i18n.t('moves')}: ${state.moves} · ${i18n.t('par')}: ${state.par}` + (state.gemsLeft ? ` · ${i18n.t('gems')}: ${state.gemsLeft}` : '');
}

window.movePlayer = (dir) => {
    if (!state || state.exited) return;
    const passed = IceEngine.slide(state, dir);
    if (!passed.length) return;
    render();
    if (state.exited) {
        setStatus(state.moves <= state.par ? 'status_perfect' : 'status_solved');
        Progress.markSolved(currentLevelIdx);
        const solvedLevelIdx = currentLevelIdx;
        setTimeout(() => {
            if (solvedLevelIdx === currentLevelIdx) nextLevel();
        }, 1800);
    } else if (state.cells[state.player[0]][state.player[1]] === 'X') {
        setStatus('status_locked');
    } else if (statusKey !== 'status_play') {
        setStatus('status_play');
    }
};

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

document.addEventListener('keydown', (event) => {
    const inFormControl = event.target instanceof Element && event.target.closest('select, input');
    if (inFormControl || document.querySelector('.modal.active')) return;
    const keys = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right' };
    const dir = keys[event.key] ?? keys[event.key.toLowerCase()];
    if (dir) movePlayer(dir);
    else if (event.key.toLowerCase() === 'r') loadLevel(currentLevelIdx);
    else return;
    event.preventDefault();
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
    movePlayer(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
});

document.getElementById('restartBtn').onclick = () => loadLevel(currentLevelIdx);

window.addEventListener('langChanged', () => {
    setStatus(statusKey);
    updateLevelInfo();
    render();
});

// Initial Load
if (LevelRegistry.length > 0) loadLevel(Progress.startLevel());
