const ENGINE = ClobberEngine;
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

function render() {
    const rows = state.length;
    const cols = state[0].length;
    boardEl.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    boardEl.style.maxWidth = `${cols * 56}px`;
    const mine = ENGINE.moves(state, PLAYER);
    const movable = new Set(mine.map(m => m.from.join(',')));
    const targets = new Set(selected ? mine.filter(m => m.from[0] === selected[0] && m.from[1] === selected[1]).map(m => m.to.join(',')) : []);
    const cells = [];
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const ch = state[r][c];
            const classes = ['cell', (r + c) % 2 ? 'dark' : 'light',
                selected && selected[0] === r && selected[1] === c ? 'selected' : '',
                !isAiTurn && !isOver && movable.has(`${r},${c}`) ? 'movable' : '',
                targets.has(`${r},${c}`) ? 'target' : '',
                lastMove && lastMove.move.to[0] === r && lastMove.move.to[1] === c ? `last ${lastMove.owner === PLAYER ? 'blue' : 'red'}` : ''].join(' ');
            const stone = ch === '.' ? '' : `<span class="stone ${ch === 'B' ? 'blue' : 'red'}"></span>`;
            cells.push(`<div class="${classes}" onclick="handleCell(${r}, ${c})">${stone}</div>`);
        }
    }
    boardEl.innerHTML = cells.join('');
    countersEl.innerText = `${i18n.t('moves')}: ${moves} · ${i18n.t('your_moves')}: ${mine.length} · ${i18n.t('ai_moves')}: ${ENGINE.moves(state, AI).length}`;
}

window.handleCell = (r, c) => {
    if (isAiTurn || isOver) return;
    const mine = ENGINE.moves(state, PLAYER);
    if (selected) {
        const move = mine.find(m => m.from[0] === selected[0] && m.from[1] === selected[1] && m.to[0] === r && m.to[1] === c);
        if (move) { playMove(move); return; }
    }
    selected = mine.some(m => m.from[0] === r && m.from[1] === c) && !(selected && selected[0] === r && selected[1] === c) ? [r, c] : null;
    render();
};

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
