const ENGINE = CramEngine;
const PLAYER = 'B';
const AI = 'R';

let currentLevelIdx = 0;
let state = null;
let selected = null;
let isAiTurn = false;
let isOver = false;
let gameId = 0; // Bumped on every level load so a pending AI move from an old game is dropped
let statusKey = '';
let moves = 0;
let lastMove = null;

const boardEl = document.getElementById('game-board');
const statusEl = document.getElementById('status');
const levelInfoEl = document.getElementById('level-info');
const countersEl = document.getElementById('counters');
let dragFrom = null;

function render() {
    const rows = state.length;
    const cols = state[0].length;
    boardEl.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    boardEl.style.maxWidth = `${cols * 56}px`;
    const targets = new Set();
    if (selected && !isAiTurn && !isOver) {
        [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(([dr, dc]) => {
            if (state[selected[0] + dr]?.[selected[1] + dc] === '.') targets.add(`${selected[0] + dr},${selected[1] + dc}`);
        });
    }
    const last = new Set();
    if (lastMove) {
        const { r, c, dir } = lastMove.move;
        last.add(`${r},${c}`);
        last.add(dir === 'h' ? `${r},${c + 1}` : `${r + 1},${c}`);
    }
    const cells = [];
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const ch = state[r][c];
            const classes = ['cell', ch === '.' ? 'empty' : ch === 'B' ? 'blue' : 'red',
                ch === '.' && !isAiTurn && !isOver ? 'playable' : '',
                selected && selected[0] === r && selected[1] === c ? 'selected' : '',
                targets.has(`${r},${c}`) ? 'target' : '', last.has(`${r},${c}`) ? 'last' : ''].join(' ');
            cells.push(`<div class="${classes}" data-r="${r}" data-c="${c}"></div>`);
        }
    }
    boardEl.innerHTML = cells.join('');
    countersEl.innerText = `${i18n.t('moves')}: ${moves} · ${i18n.t('spaces')}: ${ENGINE.moves(state).length}`;
}

function moveBetween(a, b) {
    if (Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) !== 1) return false;
    if (state[a[0]][a[1]] !== '.' || state[b[0]][b[1]] !== '.') return false;
    const r = Math.min(a[0], b[0]);
    const c = Math.min(a[1], b[1]);
    playMove({ r, c, dir: a[0] === b[0] ? 'h' : 'v' });
    return true;
}

// Tap a cell then a neighbor, or drag between two neighboring cells
function cellAt(event) {
    const el = document.elementFromPoint(event.clientX, event.clientY)?.closest('.cell');
    return el ? [Number(el.dataset.r), Number(el.dataset.c)] : null;
}

boardEl.addEventListener('pointerdown', (event) => {
    if (isAiTurn || isOver) return;
    const cell = cellAt(event);
    if (!cell || state[cell[0]][cell[1]] !== '.') return;
    event.preventDefault();
    dragFrom = cell;
    boardEl.setPointerCapture(event.pointerId);
});

boardEl.addEventListener('pointerup', (event) => {
    if (!dragFrom) return;
    const from = dragFrom;
    dragFrom = null;
    const cell = cellAt(event);
    if (cell && (cell[0] !== from[0] || cell[1] !== from[1])) {
        if (moveBetween(from, cell)) return;
    }
    // a tap: select, or complete a pair with the previous selection
    if (selected && moveBetween(selected, from)) return;
    selected = selected && selected[0] === from[0] && selected[1] === from[1] ? null : from;
    render();
});

// ---- shared turn flow (identical in the four small strategy games) ----
function loadLevel(idx) {
    const level = LevelRegistry[idx];
    if (!level) return;

    currentLevelIdx = idx;
    Progress.setCurrent(idx);
    gameId++;
    ENGINE.resetMemo();
    state = ENGINE.create(level);
    selected = null;
    isAiTurn = false;
    isOver = false;
    moves = 0;
    lastMove = null;
    updateLevelInfo();
    setStatus('status_your_turn');
    render();
}

function playMove(move) {
    lastMove = { move, owner: PLAYER };
    state = ENGINE.apply(state, move, PLAYER);
    selected = null;
    moves++;
    render();
    if (checkEnd(AI)) return;

    isAiTurn = true;
    setStatus('status_ai');
    render();
    const moveGameId = gameId;
    setTimeout(() => processAiTurn(moveGameId), 450);
}

function processAiTurn(moveGameId) {
    if (moveGameId !== gameId || isOver) return;

    const difficulty = document.getElementById('difficulty').value;
    const move = difficulty === 'master' ? ENGINE.getMasterMove(state, AI) : ENGINE.getNoviceMove(state, AI);
    isAiTurn = false;
    if (!move) { endGame(PLAYER); return; }
    lastMove = { move, owner: AI };
    state = ENGINE.apply(state, move, AI);
    moves++;
    render();
    if (checkEnd(PLAYER)) return;
    setStatus('status_your_turn');
}

// The side that has to move next and cannot, loses
function checkEnd(nextPlayer) {
    if (ENGINE.moves(state, nextPlayer).length > 0) return false;
    endGame(nextPlayer === AI ? PLAYER : AI);
    return true;
}

function endGame(winner) {
    isOver = true;
    isAiTurn = false;
    selected = null;
    render();
    if (winner === PLAYER) {
        setStatus('win');
        Progress.markSolved(currentLevelIdx);
        const winGameId = gameId;
        setTimeout(() => {
            if (winGameId === gameId) nextLevel();
        }, 2200);
    } else {
        setStatus('lose');
    }
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

document.getElementById('restartBtn').onclick = () => loadLevel(currentLevelIdx);

window.addEventListener('langChanged', () => {
    setStatus(statusKey);
    updateLevelInfo();
    render();
});

// Initial Load
if (LevelRegistry.length > 0) loadLevel(Progress.startLevel());
