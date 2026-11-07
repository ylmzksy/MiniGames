const PLAYER = 'white';
const AI = 'black';

let currentLevelIdx = 0;
let board = null;
let selected = null;
let isAiTurn = false;
let isOver = false;
let gameId = 0;
let statusKey = '';
let lastMove = null;
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
    board = BreakthroughEngine.create(level.size);
    selected = null;
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
    const targets = new Set(selected ? BreakthroughEngine.moves(board, PLAYER)
        .filter(m => m.from[0] === selected[0] && m.from[1] === selected[1]).map(m => `${m.to[0]},${m.to[1]}`) : []);
    const cells = [];
    for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
            const p = board[r][c];
            const classes = ['cell', (r + c) % 2 ? 'dark' : 'light',
                selected && selected[0] === r && selected[1] === c ? 'selected' : '',
                targets.has(`${r},${c}`) ? 'target' : '',
                lastMove && ((lastMove.from[0] === r && lastMove.from[1] === c) || (lastMove.to[0] === r && lastMove.to[1] === c)) ? 'last' : '',
                p === PLAYER && !isAiTurn && !isOver ? 'mine' : ''].join(' ');
            cells.push(`<div class="${classes}" onclick="handleCell(${r}, ${c})">${p ? `<span class="pawn ${p}"></span>` : ''}</div>`);
        }
    }
    boardEl.innerHTML = cells.join('');
    const mine = board.flat().filter(v => v === PLAYER).length;
    const theirs = board.flat().filter(v => v === AI).length;
    countersEl.innerText = `${i18n.t('you')} ${mine} – ${theirs} ${i18n.t('ai')} · ${i18n.t('moves')}: ${moves}`;
}

window.handleCell = (r, c) => {
    if (isAiTurn || isOver) return;
    if (board[r][c] === PLAYER) {
        selected = selected && selected[0] === r && selected[1] === c ? null : [r, c];
        setStatus(selected ? 'status_target' : 'status_your_turn');
        render();
        return;
    }
    if (!selected) return;
    const move = BreakthroughEngine.moves(board, PLAYER).find(m => m.from[0] === selected[0] && m.from[1] === selected[1] && m.to[0] === r && m.to[1] === c);
    if (!move) return;
    board = BreakthroughEngine.apply(board, move);
    lastMove = move;
    selected = null;
    moves++;
    render();
    if (checkEnd()) return;
    isAiTurn = true;
    setStatus('status_ai');
    const moveGameId = gameId;
    setTimeout(() => processAiTurn(moveGameId), 400);
};

function processAiTurn(moveGameId) {
    if (moveGameId !== gameId || isOver) return;
    const difficulty = document.getElementById('difficulty').value;
    const level = LevelRegistry[currentLevelIdx];
    const move = difficulty === 'master' ? BreakthroughEngine.getMasterMove(board, AI, level.depth) : BreakthroughEngine.getNoviceMove(board, AI);
    isAiTurn = false;
    if (!move) { endGame(PLAYER); return; }
    board = BreakthroughEngine.apply(board, move);
    lastMove = move;
    moves++;
    render();
    if (checkEnd()) return;
    if (!BreakthroughEngine.moves(board, PLAYER).length) { endGame(AI); return; }
    setStatus('status_your_turn');
}

function checkEnd() {
    const winner = BreakthroughEngine.winner(board);
    if (!winner) return false;
    endGame(winner);
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
        }, 2400);
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
    levelInfoEl.innerText = `${i18n.t('level')} ${currentLevelIdx + 1}/${LevelRegistry.length}: ${level.name} (${level.size}×${level.size})`;
}

document.getElementById('restartBtn').onclick = () => loadLevel(currentLevelIdx);

window.addEventListener('langChanged', () => {
    setStatus(statusKey);
    updateLevelInfo();
    render();
});

if (LevelRegistry.length > 0) loadLevel(Progress.startLevel());
