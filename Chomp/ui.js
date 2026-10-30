const PLAYER = 'blue';
const AI = 'red';

let currentLevelIdx = 0;
let state = null;
let isAiTurn = false;
let isOver = false;
let gameId = 0; // Bumped on every level load so a pending AI move from an old game is dropped
let statusKey = '';
let moves = 0;
let lastBite = null;   // { r, c, owner } of the latest move, for the highlight

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
    state = ChompEngine.create(level);
    isAiTurn = false;
    isOver = false;
    moves = 0;
    lastBite = null;
    updateLevelInfo();
    setStatus('status_your_turn');
    render();
}

function render() {
    const level = LevelRegistry[currentLevelIdx];
    boardEl.style.gridTemplateColumns = `repeat(${level.cols}, 1fr)`;
    boardEl.style.maxWidth = `${level.cols * 64}px`;

    const cells = [];
    for (let r = 0; r < level.rows; r++) {
        for (let c = 0; c < level.cols; c++) {
            const present = ChompEngine.isSquare(state, r, c);
            const bitten = lastBite && !present && r >= lastBite.r && c >= lastBite.c;
            const classes = ['square', present ? 'chocolate' : 'eaten', r === 0 && c === 0 ? 'poison' : '',
                bitten ? `bitten ${lastBite.owner}` : '', present && !isOver && !isAiTurn ? 'free' : ''].join(' ');
            cells.push(`<div class="${classes}" data-r="${r}" data-c="${c}" onclick="handleBite(${r}, ${c})" onmouseenter="preview(${r}, ${c})" onmouseleave="preview(-1, -1)">${r === 0 && c === 0 ? '☠' : ''}</div>`);
        }
    }
    boardEl.innerHTML = cells.join('');
    countersEl.innerText = `${i18n.t('squares_left')}: ${ChompEngine.squaresLeft(state)} · ${i18n.t('moves')}: ${moves}`;
}

// Shows which squares a bite at (r, c) would take
window.preview = (r, c) => {
    boardEl.querySelectorAll('.square').forEach(el => {
        const er = Number(el.dataset.r);
        const ec = Number(el.dataset.c);
        el.classList.toggle('preview', r >= 0 && !isAiTurn && !isOver && ChompEngine.isSquare(state, er, ec) && er >= r && ec >= c);
    });
};

window.handleBite = (r, c) => {
    if (isAiTurn || isOver || !ChompEngine.isSquare(state, r, c)) return;
    state = ChompEngine.eat(state, r, c);
    lastBite = { r, c, owner: PLAYER };
    moves++;
    render();
    if (r === 0 && c === 0) { endGame(AI); return; } // ate the poison
    if (checkEnd(AI)) return;

    isAiTurn = true;
    setStatus('status_ai');
    const moveGameId = gameId;
    setTimeout(() => processAiTurn(moveGameId), 500);
};

function processAiTurn(moveGameId) {
    if (moveGameId !== gameId || isOver) return;

    const difficulty = document.getElementById('difficulty').value;
    const [r, c] = difficulty === 'master' ? ChompEngine.getMasterMove(state) : ChompEngine.getNoviceMove(state);
    state = ChompEngine.eat(state, r, c);
    lastBite = { r, c, owner: AI };
    moves++;
    isAiTurn = false;
    render();
    if (r === 0 && c === 0) { endGame(PLAYER); return; }
    if (checkEnd(PLAYER)) return;
    setStatus('status_your_turn');
}

// When only the poison is left, the side to move must eat it and loses
function checkEnd(nextPlayer) {
    if (ChompEngine.squaresLeft(state) > 1) return false;
    endGame(nextPlayer === AI ? PLAYER : AI);
    return true;
}

function endGame(winner) {
    isOver = true;
    isAiTurn = false;
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
    levelInfoEl.innerText = `${i18n.t('level')} ${currentLevelIdx + 1}/${LevelRegistry.length}: ${level.name} (${level.rows}×${level.cols})`;
}

document.getElementById('restartBtn').onclick = () => loadLevel(currentLevelIdx);

window.addEventListener('langChanged', () => {
    setStatus(statusKey);
    updateLevelInfo();
    render();
});

// Initial Load
if (LevelRegistry.length > 0) loadLevel(Progress.startLevel());
