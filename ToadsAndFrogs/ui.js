const ENGINE = ToadsEngine;
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
    boardEl.style.gridTemplateColumns = `repeat(${state.length}, 1fr)`;
    boardEl.style.maxWidth = `${state.length * 64}px`;
    const mine = ENGINE.moves(state, PLAYER);
    const movable = new Set(mine.map(m => m.from));
    boardEl.innerHTML = state.map((ch, i) => {
        const classes = ['cell', ch === '.' ? 'empty' : ch === 'B' ? 'toad' : 'frog',
            !isAiTurn && !isOver && movable.has(i) ? 'movable' : '',
            lastMove && lastMove.move.to === i ? `last ${lastMove.owner === PLAYER ? 'blue' : 'red'}` : ''].join(' ');
        const glyph = ch === 'B' ? '🐢' : ch === 'R' ? '🐸' : '';
        return `<div class="${classes}" onclick="handleCell(${i})">${glyph}</div>`;
    }).join('');
    countersEl.innerText = `${i18n.t('moves')}: ${moves} · ${i18n.t('your_moves')}: ${mine.length} · ${i18n.t('ai_moves')}: ${ENGINE.moves(state, AI).length}`;
}

window.handleCell = (i) => {
    if (isAiTurn || isOver) return;
    const move = ENGINE.moves(state, PLAYER).find(m => m.from === i);
    if (move) playMove(move);
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
