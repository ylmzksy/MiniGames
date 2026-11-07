const SWIPE_MIN = 24;
const HIDDEN_ROWS = 0; // rows above the visible well

let currentLevelIdx = 0;
let level = null;
let state = null;
let timer = null;
let softDrop = false;
let statusKey = 'status_play';

const board = document.getElementById('game-board');
const nextEl = document.getElementById('next');
const statusEl = document.getElementById('status');
const levelInfoEl = document.getElementById('level-info');
const countersEl = document.getElementById('counters');

function loadLevel(idx) {
    level = LevelRegistry[idx];
    if (!level) return;

    currentLevelIdx = idx;
    Progress.setCurrent(idx);
    state = ColumnsEngine.create(level);
    softDrop = false;
    setStatus('status_play');
    updateLevelInfo();
    render();
    schedule();
}

function schedule() {
    clearTimeout(timer);
    timer = setTimeout(tick, softDrop ? Math.min(60, level.speed) : level.speed);
}

// Gravity tick: the piece falls one row, or lands and the well settles
function tick() {
    if (!state || state.over || state.won) return;
    ColumnsEngine.drop(state);
    afterChange();
    if (!state.over && !state.won) schedule();
}

function afterChange() {
    render();
    if (state.won) {
        clearTimeout(timer);
        setStatus('status_solved');
        Progress.markSolved(currentLevelIdx);
        const solvedLevelIdx = currentLevelIdx;
        setTimeout(() => {
            if (solvedLevelIdx === currentLevelIdx) nextLevel();
        }, 2000);
    } else if (state.over) {
        clearTimeout(timer);
        setStatus('status_over');
    }
}

function cellColor(v) {
    return ((v) => v)(v);
}

function render() {
    const rows = state.height - HIDDEN_ROWS;
    board.style.gridTemplateColumns = `repeat(${state.width}, 1fr)`;
    board.style.maxWidth = `${state.width * 34}px`;
    const grid = state.cells.map(row => row.map(v => cellColor(v)));
    const virus = state.cells.map(row => row.map(v => v && typeof v === 'object' && v.virus));
    const p = state.piece;
    const falling = new Set();
    (p ? [0,1,2].map(i => [p.row + i, p.col, p.gems[i]]) : []).forEach(([r, c, col]) => { if (r >= 0 && r < state.height) { grid[r][c] = col; falling.add(`${r},${c}`); } });

    const cells = [];
    for (let r = HIDDEN_ROWS; r < state.height; r++) {
        for (let c = 0; c < state.width; c++) {
            const col = grid[r][c];
            const classes = ['cell', col === null ? 'empty' : `c${col}`, falling.has(`${r},${c}`) ? 'falling' : '', virus[r][c] ? 'virus' : '', state.over ? 'over' : '', state.won ? 'won' : ''].join(' ');
            cells.push(`<div class="${classes}"></div>`);
        }
    }
    board.innerHTML = cells.join('');

    nextEl.style.gridTemplateColumns = `repeat(${1}, 22px)`;
    const nextGrid = Array.from({ length: 3 }, () => Array(1).fill(null));
    (state.next.map((g, i) => [i, 0, g])).forEach(([r, c, col]) => { nextGrid[r][c] = col; });
    nextEl.innerHTML = nextGrid.flat().map(col => `<div class="cell ${col === null ? 'empty' : `c${col}`}"></div>`).join('');
    countersEl.innerText = `${i18n.t('cleared')}: ${state.cleared}/${state.target} · ${i18n.t('score')}: ${state.score} · ${i18n.t('chain')}: ${state.chainBest}`;
}

function act(action) {
    if (!state || state.over || state.won) return;
    if (action === 'left') ColumnsEngine.move(state, -1);
    else if (action === 'right') ColumnsEngine.move(state, 1);
    else if (action === 'rotate') ColumnsEngine.cycle(state);
    else if (action === 'down') { ColumnsEngine.drop(state); schedule(); }
    afterChange();
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
    levelInfoEl.innerText = `${i18n.t('level')} ${currentLevelIdx + 1}/${LevelRegistry.length}: ${level.name}`;
}

const KEYS = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'rotate', ArrowDown: 'down', a: 'left', d: 'right', w: 'rotate', s: 'down', ' ': 'rotate' };

document.addEventListener('keydown', (event) => {
    const inFormControl = event.target instanceof Element && event.target.closest('select, input');
    if (inFormControl || document.querySelector('.modal.active')) return;
    const action = KEYS[event.key] ?? KEYS[event.key.toLowerCase()];
    if (action) {
        if (action === 'down') { if (!softDrop) { softDrop = true; schedule(); } act('down'); }
        else if (!event.repeat || action !== 'rotate') act(action);
    } else if (event.key.toLowerCase() === 'r') {
        loadLevel(currentLevelIdx);
    } else {
        return;
    }
    event.preventDefault();
});

document.addEventListener('keyup', (event) => {
    const action = KEYS[event.key] ?? KEYS[event.key.toLowerCase()];
    if (action === 'down' && softDrop) { softDrop = false; if (state && !state.over && !state.won) schedule(); }
});

document.querySelectorAll('.pad button[data-action]').forEach(btn => {
    btn.addEventListener('pointerdown', (event) => { event.preventDefault(); act(btn.dataset.action); });
});

// Swipe left/right moves, swipe down drops, tap rotates
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
    if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_MIN) { act('rotate'); return; }
    if (Math.abs(dx) > Math.abs(dy)) act(dx > 0 ? 'right' : 'left');
    else if (dy > 0) act('down');
});

document.getElementById('restartBtn').onclick = () => loadLevel(currentLevelIdx);

window.addEventListener('langChanged', () => {
    setStatus(statusKey);
    updateLevelInfo();
    render();
});

// Initial Load
if (LevelRegistry.length > 0) loadLevel(Progress.startLevel());
