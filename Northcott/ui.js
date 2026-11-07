const PLAYER = 'blue';
const AI = 'red';

let currentLevelIdx = 0;
let state = null;
let selectedRow = null;
let isAiTurn = false;
let isOver = false;
let gameId = 0; // Bumped on every level load so a pending AI move from an old game is dropped
let statusKey = '';
let moves = 0;
let lastMove = null; // { row, from, to, owner }

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
    state = NorthcottEngine.create(level);
    selectedRow = null;
    isAiTurn = false;
    isOver = false;
    moves = 0;
    lastMove = null;
    updateLevelInfo();
    setStatus('status_your_turn');
    render();
}

function render() {
    boardEl.style.gridTemplateColumns = `repeat(${state.width}, 1fr)`;
    boardEl.style.maxWidth = `${state.width * 46}px`;
    const targets = new Set(selectedRow === null ? [] : NorthcottEngine.targets(state, selectedRow, PLAYER).map(c => `${selectedRow},${c}`));
    const cells = [];
    state.rows.forEach((row, r) => {
        for (let c = 0; c < state.width; c++) {
            const key = `${r},${c}`;
            const checker = row.blue === c ? 'blue' : row.red === c ? 'red' : '';
            const classes = ['cell', (r + c) % 2 ? 'dark' : 'light', targets.has(key) ? 'target' : '',
                lastMove && lastMove.row === r && lastMove.from === c ? `from ${lastMove.owner}` : '',
                checker === PLAYER && !isAiTurn && !isOver ? 'mine' : '', r === selectedRow && checker === PLAYER ? 'selected' : ''].join(' ');
            cells.push(`<div class="${classes}" onclick="handleCell(${r}, ${c})">${checker ? `<span class="checker ${checker}"></span>` : ''}</div>`);
        }
    });
    boardEl.innerHTML = cells.join('');
    countersEl.innerText = `${i18n.t('gaps')}: ${state.rows.map(r => NorthcottEngine.gap(r)).join(' · ')} · ${i18n.t('moves')}: ${moves}`;
}

window.handleCell = (r, c) => {
    if (isAiTurn || isOver) return;
    if (state.rows[r].blue === c) {
        selectedRow = selectedRow === r ? null : r;
        setStatus(selectedRow === null ? 'status_your_turn' : 'status_pick_target');
        render();
        return;
    }
    if (selectedRow !== r || !NorthcottEngine.targets(state, r, PLAYER).includes(c)) return;
    playMove({ row: r, to: c });
};

function playMove(move) {
    lastMove = { row: move.row, from: state.rows[move.row].blue, to: move.to, owner: PLAYER };
    state = NorthcottEngine.apply(state, PLAYER, move);
    selectedRow = null;
    moves++;
    render();
    if (checkEnd(AI)) return;

    isAiTurn = true;
    setStatus('status_ai');
    const moveGameId = gameId;
    setTimeout(() => processAiTurn(moveGameId), 500);
}

function processAiTurn(moveGameId) {
    if (moveGameId !== gameId || isOver) return;

    const difficulty = document.getElementById('difficulty').value;
    const move = difficulty === 'master' ? NorthcottEngine.getMasterMove(state, AI) : NorthcottEngine.getNoviceMove(state, AI);
    lastMove = { row: move.row, from: state.rows[move.row].red, to: move.to, owner: AI };
    state = NorthcottEngine.apply(state, AI, move);
    moves++;
    isAiTurn = false;
    render();
    if (checkEnd(PLAYER)) return;
    setStatus('status_your_turn');
}

// The side that has to move next and cannot, loses
function checkEnd(nextPlayer) {
    if (NorthcottEngine.moves(state, nextPlayer).length > 0) return false;
    isOver = true;
    isAiTurn = false;
    render();
    if (nextPlayer === AI) {
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
