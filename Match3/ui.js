const GEMS = ['#e03b3b', '#3b6fe0', '#1f9d55', '#f5b301', '#9b4ddb', '#17b8c8'];
const SWAP_MIN = 18;

let currentLevelIdx = 0;
let state = null;
let selected = null;
let busy = false;
let isSolved = false;
let isFailed = false;
let statusKey = 'status_play';
let dragFrom = null;

const board = document.getElementById('game-board');
const statusEl = document.getElementById('status');
const levelInfoEl = document.getElementById('level-info');
const countersEl = document.getElementById('counters');

function loadLevel(idx) {
    const level = LevelRegistry[idx];
    if (!level) return;

    currentLevelIdx = idx;
    Progress.setCurrent(idx);
    state = Match3Engine.create(level);
    selected = null;
    busy = false;
    isSolved = false;
    isFailed = false;
    setStatus('status_play');
    updateLevelInfo();
    render();
}

function render(highlight = new Set()) {
    board.style.gridTemplateColumns = `repeat(${state.width}, 1fr)`;
    const cells = [];
    for (let r = 0; r < state.height; r++) {
        for (let c = 0; c < state.width; c++) {
            const v = state.board[r][c];
            const classes = ['cell', selected && selected[0] === r && selected[1] === c ? 'selected' : '', highlight.has(`${r},${c}`) ? 'clearing' : ''].join(' ');
            cells.push(`<div class="${classes}" data-r="${r}" data-c="${c}"><span class="gem g${v}" style="--gem:${GEMS[v]}"></span></div>`);
        }
    }
    board.innerHTML = cells.join('');
    countersEl.innerText = `${i18n.t('score')}: ${state.score}/${state.target} · ${i18n.t('moves_left')}: ${state.moves}`;
}

function cellAt(event) {
    const el = document.elementFromPoint(event.clientX, event.clientY)?.closest('.cell');
    return el ? [Number(el.dataset.r), Number(el.dataset.c)] : null;
}

board.addEventListener('pointerdown', (event) => {
    if (busy || isSolved || isFailed) return;
    const cell = cellAt(event);
    if (!cell) return;
    event.preventDefault();
    dragFrom = { cell, x: event.clientX, y: event.clientY };
    board.setPointerCapture(event.pointerId);
});

board.addEventListener('pointermove', (event) => {
    if (!dragFrom || busy) return;
    const dx = event.clientX - dragFrom.x;
    const dy = event.clientY - dragFrom.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < SWAP_MIN) return;
    const [r, c] = dragFrom.cell;
    const target = Math.abs(dx) > Math.abs(dy) ? [r, c + Math.sign(dx)] : [r + Math.sign(dy), c];
    dragFrom = null;
    selected = null;
    trySwap([r, c], target);
});

board.addEventListener('pointerup', (event) => {
    if (!dragFrom) return;
    const cell = dragFrom.cell;
    dragFrom = null;
    tapCell(cell);
});

// Tapping two neighboring gems swaps them; tapping elsewhere moves the selection
function tapCell(cell) {
    if (busy || isSolved || isFailed) return;
    if (selected && Math.abs(selected[0] - cell[0]) + Math.abs(selected[1] - cell[1]) === 1) {
        const from = selected;
        selected = null;
        trySwap(from, cell);
        return;
    }
    selected = selected && selected[0] === cell[0] && selected[1] === cell[1] ? null : cell;
    render();
}

function inBoard([r, c]) {
    return r >= 0 && c >= 0 && r < state.height && c < state.width;
}

function trySwap(a, b) {
    if (!inBoard(a) || !inBoard(b)) { render(); return; }
    if (!Match3Engine.swapMakesMatch(state.board, a, b)) {
        setStatus('status_no_match');
        render();
        return;
    }
    Match3Engine.swap(state.board, a, b);
    state.moves--;
    setStatus('status_play');
    busy = true;
    cascade(1);
}

// Clears matches one chain step at a time so the player can see them go
function cascade(chain) {
    const matched = Match3Engine.findMatches(state.board);
    if (!matched.size) {
        if (!Match3Engine.hasMoves(state.board)) { Match3Engine.reshuffle(state); setStatus('status_reshuffle'); }
        busy = false;
        render();
        checkEnd();
        return;
    }
    render(matched);
    setTimeout(() => {
        Match3Engine.step(state, chain);
        render();
        setTimeout(() => cascade(chain + 1), 80);
    }, 140);
}

function checkEnd() {
    if (state.score >= state.target) {
        isSolved = true;
        setStatus('status_solved');
        Progress.markSolved(currentLevelIdx);
        const solvedLevelIdx = currentLevelIdx;
        setTimeout(() => { if (solvedLevelIdx === currentLevelIdx) nextLevel(); }, 1800);
    } else if (state.moves <= 0) {
        isFailed = true;
        setStatus('status_failed');
    }
}

function nextLevel() {
    if (currentLevelIdx + 1 < LevelRegistry.length) loadLevel(currentLevelIdx + 1);
    else setStatus('all_levels_cleared');
}

function setStatus(key) {
    statusKey = key;
    statusEl.innerText = i18n.t(key, { target: state.target });
}

function updateLevelInfo() {
    const level = LevelRegistry[currentLevelIdx];
    levelInfoEl.innerText = `${i18n.t('level')} ${currentLevelIdx + 1}/${LevelRegistry.length}: ${level.name}`;
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
