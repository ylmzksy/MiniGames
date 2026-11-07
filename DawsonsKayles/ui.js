const PLAYER = 'blue';
const AI = 'red';

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

function loadLevel(idx) {
    const level = LevelRegistry[idx];
    if (!level) return;

    currentLevelIdx = idx;
    Progress.setCurrent(idx);
    gameId++;
    state = DawsonEngine.create(level);
    selected = null;
    isAiTurn = false;
    isOver = false;
    moves = 0;
    lastMove = null;
    updateLevelInfo();
    setStatus('status_your_turn');
    render();
}

function render() {
    const pins = state.map((up, i) => {
        const fallen = lastMove && lastMove.pins.includes(i) ? `fallen ${lastMove.owner}` : '';
        const pair = selected !== null && Math.abs(i - selected) === 1 && up ? 'pair' : '';
        const classes = ['pin', up ? 'up' : 'down', i === selected ? 'selected' : '', pair, up && !isAiTurn && !isOver ? 'free' : '', fallen].join(' ');
        return `<div class="${classes}" onclick="handlePin(${i})"><i class="head"></i><i class="body"></i></div>`;
    }).join('');
    boardEl.innerHTML = `<div class="lane">${pins}</div>`;
    countersEl.innerText = `${i18n.t('standing')}: ${DawsonEngine.standing(state)} · ${i18n.t('moves')}: ${moves}`;
}

// Tap a pin, then its standing neighbor, to knock both down
window.handlePin = (i) => {
    if (isAiTurn || isOver || !state[i]) return;
    if (selected === null) {
        selected = i;
        setStatus('status_pick_second');
        render();
        return;
    }
    if (i === selected) { selected = null; setStatus('status_your_turn'); render(); return; }
    if (Math.abs(i - selected) === 1) { playMove([Math.min(i, selected), Math.max(i, selected)]); return; }
    selected = i;
    render();
};

function playMove(move) {
    selected = null;
    state = DawsonEngine.apply(state, move);
    lastMove = { pins: move, owner: PLAYER };
    moves++;
    render();
    if (checkEnd(PLAYER)) return;

    isAiTurn = true;
    setStatus('status_ai');
    const moveGameId = gameId;
    setTimeout(() => processAiTurn(moveGameId), 500);
}

function processAiTurn(moveGameId) {
    if (moveGameId !== gameId || isOver) return;

    const difficulty = document.getElementById('difficulty').value;
    const move = difficulty === 'master' ? DawsonEngine.getMasterMove(state) : DawsonEngine.getNoviceMove(state);
    state = DawsonEngine.apply(state, move);
    lastMove = { pins: move, owner: AI };
    moves++;
    isAiTurn = false;
    render();
    if (checkEnd(AI)) return;
    setStatus('status_your_turn');
}

// After a move, the other side loses if it has no pair left to knock down
function checkEnd(mover) {
    if (DawsonEngine.moves(state).length > 0) return false;
    isOver = true;
    isAiTurn = false;
    render();
    if (mover === PLAYER) {
        setStatus('win');
        Progress.markSolved(currentLevelIdx);
        const winGameId = gameId;
        setTimeout(() => {
            if (winGameId === gameId) nextLevel();
        }, 2200);
    } else {
        setStatus('lose');
    }
    return true;
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
