const ENGINE = DomineeringEngine;
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
    const tops = new Set(!isAiTurn && !isOver ? ENGINE.moves(state, PLAYER).map(([r, c]) => `${r},${c}`) : []);
    const last = new Set();
    if (lastMove) {
        const [r, c] = lastMove.move;
        last.add(`${r},${c}`);
        last.add(lastMove.owner === PLAYER ? `${r + 1},${c}` : `${r},${c + 1}`);
    }
    const cells = [];
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const ch = state[r][c];
            const playable = tops.has(`${r},${c}`) || tops.has(`${r - 1},${c}`);
            // mark which side of a domino a cell is, so the two halves join visually
            const joins = ch === 'B' ? (state[r - 1]?.[c] === 'B' && isSecondHalf(r, c) ? 'join-up' : 'join-down')
                : ch === 'R' ? (isSecondHalfH(r, c) ? 'join-left' : 'join-right') : '';
            const classes = ['cell', ch === '.' ? 'empty' : ch === 'B' ? 'blue' : 'red', joins, playable ? 'playable' : '', last.has(`${r},${c}`) ? 'last' : ''].join(' ');
            cells.push(`<div class="${classes}" onclick="handleCell(${r}, ${c})"></div>`);
        }
    }
    boardEl.innerHTML = cells.join('');
    countersEl.innerText = `${i18n.t('moves')}: ${moves} · ${i18n.t('your_moves')}: ${ENGINE.moves(state, PLAYER).length} · ${i18n.t('ai_moves')}: ${ENGINE.moves(state, AI).length}`;
}

// Dominoes are stored as two cells; the lower/right cell of a pair is its second half.
// Blue dominoes are vertical, so pairs are found by walking down the column from the top.
function isSecondHalf(r, c) {
    let count = 0;
    for (let i = 0; i <= r; i++) if (state[i][c] === 'B') count++; else count = 0;
    return count % 2 === 0;
}

function isSecondHalfH(r, c) {
    let count = 0;
    for (let j = 0; j <= c; j++) if (state[r][j] === 'R') count++; else count = 0;
    return count % 2 === 0;
}

window.handleCell = (r, c) => {
    if (isAiTurn || isOver) return;
    const tops = ENGINE.moves(state, PLAYER);
    const top = tops.find(([tr, tc]) => tr === r && tc === c) || tops.find(([tr, tc]) => tr === r - 1 && tc === c);
    if (!top) return;
    playMove(top);
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
