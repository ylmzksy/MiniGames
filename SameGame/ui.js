const BLOCKS = ['#e03b3b', '#3b6fe0', '#1f9d55', '#f5b301', '#9b4ddb'];

let currentLevelIdx = 0;
let state = null;
let hover = new Set();
let isOver = false;
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
    state = SameGameEngine.create(level);
    hover = new Set();
    isOver = false;
    setStatus('status_play');
    updateLevelInfo();
    render();
}

function render() {
    board.style.gridTemplateColumns = `repeat(${state.cols}, 1fr)`;
    const cells = [];
    for (let r = 0; r < state.rows; r++) {
        for (let c = 0; c < state.cols; c++) {
            const v = state.board[r][c];
            const classes = ['cell', v < 0 ? 'empty' : '', hover.has(`${r},${c}`) ? 'hover' : ''].join(' ');
            cells.push(`<div class="${classes}" data-r="${r}" data-c="${c}" style="--block:${v < 0 ? 'transparent' : BLOCKS[v]}"></div>`);
        }
    }
    board.innerHTML = cells.join('');
    const pct = Math.round((state.removed / state.total) * 100);
    countersEl.innerText = `${i18n.t('score')}: ${state.score}/${state.target} · ${i18n.t('cleared')}: ${pct}%`;
}

function cellOf(event) {
    const el = event.target.closest('.cell');
    return el ? [Number(el.dataset.r), Number(el.dataset.c)] : null;
}

board.addEventListener('pointermove', (event) => {
    if (isOver) return;
    const cell = cellOf(event);
    const group = cell ? SameGameEngine.group(state.board, ...cell) : [];
    const next = new Set(group.length >= 2 ? group.map(([r, c]) => `${r},${c}`) : []);
    if (next.size !== hover.size || [...next].some(k => !hover.has(k))) { hover = next; render(); }
});

board.addEventListener('pointerleave', () => { if (hover.size) { hover = new Set(); render(); } });

board.addEventListener('pointerdown', (event) => {
    if (isOver) return;
    const cell = cellOf(event);
    if (!cell) return;
    event.preventDefault();
    removeGroup(cell);
});

window.removeGroup = (cell) => {
    const group = SameGameEngine.group(state.board, ...cell);
    if (group.length < 2) { setStatus('status_single'); return; }
    const gained = SameGameEngine.remove(state, group);
    hover = new Set();
    setStatus('status_gained', { n: group.length, points: gained });
    render();
    checkEnd();
};

function checkEnd() {
    if (state.score >= state.target) {
        isOver = true;
        setStatus(SameGameEngine.isCleared(state.board) ? 'status_cleared' : 'status_solved');
        Progress.markSolved(currentLevelIdx);
        const solvedLevelIdx = currentLevelIdx;
        setTimeout(() => { if (solvedLevelIdx === currentLevelIdx) nextLevel(); }, 1800);
    } else if (!SameGameEngine.hasMoves(state.board)) {
        isOver = true;
        setStatus('status_failed');
    }
}

function nextLevel() {
    if (currentLevelIdx + 1 < LevelRegistry.length) loadLevel(currentLevelIdx + 1);
    else setStatus('all_levels_cleared');
}

function setStatus(key, params = {}) {
    statusKey = key;
    statusEl.innerText = i18n.t(key, params);
}

function updateLevelInfo() {
    const level = LevelRegistry[currentLevelIdx];
    levelInfoEl.innerText = `${i18n.t('level')} ${currentLevelIdx + 1}/${LevelRegistry.length}: ${level.name} (${level.cols}×${level.rows}, ${level.colors} ${i18n.t('colors')})`;
}

document.addEventListener('keydown', (event) => {
    if (event.key.toLowerCase() === 'r' && !document.querySelector('.modal.active')) { loadLevel(currentLevelIdx); event.preventDefault(); }
});

document.getElementById('restartBtn').onclick = () => loadLevel(currentLevelIdx);

window.addEventListener('langChanged', () => {
    setStatus(statusKey);
    updateLevelInfo();
    render();
});

// Initial Load
if (LevelRegistry.length > 0) loadLevel(Progress.startLevel());
