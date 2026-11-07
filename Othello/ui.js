const PLAYER = 'black';
const AI = 'white';

let currentLevelIdx = 0;
let board = null;
let isAiTurn = false;
let isOver = false;
let gameId = 0;
let statusKey = '';
let lastMove = null;   // { r, c, flips }
let moves = 0;

const boardEl = document.getElementById('game-board');
const statusEl = document.getElementById('status');
const levelInfoEl = document.getElementById('level-info');
const countersEl = document.getElementById('counters');

function loadLevel(idx) {
    const level = LevelRegistry[idx];
    if (!level) return;

    currentLevelIdx = idx;
    Progress.setCurrent(idx);
    gameId++;
    board = OthelloEngine.create(level.size);
    isAiTurn = false;
    isOver = false;
    lastMove = null;
    moves = 0;
    updateLevelInfo();
    setStatus('status_your_turn');
    render();
}

function render() {
    const n = board.length;
    boardEl.style.gridTemplateColumns = `repeat(${n}, 1fr)`;
    boardEl.style.maxWidth = `${n * 52}px`;
    const legal = new Set((!isAiTurn && !isOver ? OthelloEngine.legalMoves(board, PLAYER) : []).map(m => `${m.r},${m.c}`));
    const flipped = new Set(lastMove ? lastMove.flips.map(([r, c]) => `${r},${c}`) : []);
    const cells = [];
    for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
            const v = board[r][c];
            const classes = ['cell', legal.has(`${r},${c}`) ? 'legal' : '',
                lastMove && lastMove.r === r && lastMove.c === c ? 'last' : '', flipped.has(`${r},${c}`) ? 'flipped' : ''].join(' ');
            cells.push(`<div class="${classes}" onclick="handleMove(${r}, ${c})">${v ? `<span class="disc ${v}"></span>` : ''}</div>`);
        }
    }
    boardEl.innerHTML = cells.join('');
    countersEl.innerText = `${i18n.t('you')} ${OthelloEngine.count(board, PLAYER)} – ${OthelloEngine.count(board, AI)} ${i18n.t('ai')} · ${i18n.t('moves')}: ${moves}`;
}

window.handleMove = (r, c) => {
    if (isAiTurn || isOver) return;
    const flips = OthelloEngine.flips(board, r, c, PLAYER);
    if (!flips.length) return;
    const move = { r, c, flips };
    board = OthelloEngine.apply(board, move, PLAYER);
    lastMove = move;
    moves++;
    render();
    afterMove(AI);
};

// Hands the turn to `next`, handling passes and the end of the game
function afterMove(next) {
    if (OthelloEngine.isOver(board)) { endGame(); return; }
    if (!OthelloEngine.legalMoves(board, next).length) {
        setStatus(next === AI ? 'status_ai_passes' : 'status_you_pass');
        next = OthelloEngine.other(next);
        if (next === AI) { scheduleAi(); return; }
        isAiTurn = false;
        render();
        return;
    }
    if (next === AI) { scheduleAi(); return; }
    isAiTurn = false;
    setStatus('status_your_turn');
    render();
}

function scheduleAi() {
    isAiTurn = true;
    render();
    if (statusKey !== 'status_you_pass') setStatus('status_ai');
    const moveGameId = gameId;
    setTimeout(() => processAiTurn(moveGameId), 400);
}

function processAiTurn(moveGameId) {
    if (moveGameId !== gameId || isOver) return;
    const difficulty = document.getElementById('difficulty').value;
    const level = LevelRegistry[currentLevelIdx];
    const move = difficulty === 'master' ? OthelloEngine.getMasterMove(board, AI, level.depth) : OthelloEngine.getNoviceMove(board, AI);
    if (!move) { afterMove(PLAYER); return; }
    board = OthelloEngine.apply(board, move, AI);
    lastMove = move;
    moves++;
    isAiTurn = false;
    render();
    afterMove(PLAYER);
}

function endGame() {
    isOver = true;
    isAiTurn = false;
    render();
    const mine = OthelloEngine.count(board, PLAYER);
    const theirs = OthelloEngine.count(board, AI);
    if (mine > theirs) {
        setStatus('win');
        Progress.markSolved(currentLevelIdx);
        const winGameId = gameId;
        setTimeout(() => {
            if (winGameId === gameId) nextLevel();
        }, 2400);
    } else {
        setStatus(mine === theirs ? 'draw' : 'lose');
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
    levelInfoEl.innerText = `${i18n.t('level')} ${currentLevelIdx + 1}/${LevelRegistry.length}: ${level.name} (${level.size}×${level.size})`;
}

document.getElementById('restartBtn').onclick = () => loadLevel(currentLevelIdx);

window.addEventListener('langChanged', () => {
    setStatus(statusKey);
    updateLevelInfo();
    render();
});

if (LevelRegistry.length > 0) loadLevel(Progress.startLevel());
