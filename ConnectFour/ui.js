const PLAYER = 1;
const AI = 2;

let currentLevelIdx = 0;
let board = null;
let isAiTurn = false;
let isOver = false;
let gameId = 0;
let statusKey = '';
let moves = 0;
let hoverCol = -1;

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
    board = ConnectFourEngine.create(level);
    isAiTurn = false;
    isOver = false;
    moves = 0;
    hoverCol = -1;
    updateLevelInfo();
    setStatus('status_your_turn');
    render();
}

function render() {
    const win = ConnectFourEngine.winner(board);
    const winSet = new Set(win ? win.cells.map(c => c.join(',')) : []);
    boardEl.style.gridTemplateColumns = `repeat(${board.cols}, 1fr)`;
    boardEl.style.maxWidth = `${board.cols * 58}px`;
    const landing = hoverCol >= 0 && !isAiTurn && !isOver ? ConnectFourEngine.landingRow(board, hoverCol) : -1;
    const cells = [];
    for (let r = 0; r < board.rows; r++) {
        for (let c = 0; c < board.cols; c++) {
            const v = board.cells[r][c];
            const classes = ['cell', v === PLAYER ? 'p1' : v === AI ? 'p2' : 'empty',
                winSet.has(`${r},${c}`) ? 'win' : '',
                board.last && board.last[0] === r && board.last[1] === c ? 'last' : '',
                landing === r && hoverCol === c ? 'preview' : ''].join(' ');
            cells.push(`<div class="${classes}" data-col="${c}"><i></i></div>`);
        }
    }
    boardEl.innerHTML = cells.join('');
    countersEl.innerText = `${i18n.t('moves')}: ${moves}`;
}

boardEl.addEventListener('pointermove', (event) => {
    const el = event.target.closest('.cell');
    const col = el ? Number(el.dataset.col) : -1;
    if (col !== hoverCol) { hoverCol = col; render(); }
});
boardEl.addEventListener('pointerleave', () => { hoverCol = -1; render(); });
boardEl.addEventListener('click', (event) => {
    const el = event.target.closest('.cell');
    if (el) handleDrop(Number(el.dataset.col));
});

window.handleDrop = (col) => {
    if (isAiTurn || isOver || !ConnectFourEngine.canDrop(board, col)) return;
    board = ConnectFourEngine.drop(board, col, PLAYER);
    moves++;
    hoverCol = -1;
    render();
    if (checkEnd()) return;
    isAiTurn = true;
    setStatus('status_ai');
    const moveGameId = gameId;
    setTimeout(() => processAiTurn(moveGameId), 300);
};

function processAiTurn(moveGameId) {
    if (moveGameId !== gameId || isOver) return;
    const difficulty = document.getElementById('difficulty').value;
    const level = LevelRegistry[currentLevelIdx];
    const col = difficulty === 'master' ? ConnectFourEngine.getMove(board, AI, level.depth, 800) : ConnectFourEngine.getNoviceMove(board, AI);
    board = ConnectFourEngine.drop(board, col, AI);
    moves++;
    isAiTurn = false;
    render();
    if (checkEnd()) return;
    setStatus('status_your_turn');
}

function checkEnd() {
    const win = ConnectFourEngine.winner(board);
    if (!win && !ConnectFourEngine.isFull(board)) return false;
    isOver = true;
    isAiTurn = false;
    render();
    if (win && win.who === PLAYER) {
        setStatus('win');
        Progress.markSolved(currentLevelIdx);
        const winGameId = gameId;
        setTimeout(() => { if (winGameId === gameId) nextLevel(); }, 2200);
    } else {
        setStatus(win ? 'lose' : 'draw');
    }
    return true;
}

function nextLevel() {
    if (currentLevelIdx + 1 < LevelRegistry.length) loadLevel(currentLevelIdx + 1);
    else setStatus('all_levels_cleared');
}

function setStatus(key) {
    statusKey = key;
    statusEl.innerText = i18n.t(key);
}

function updateLevelInfo() {
    const level = LevelRegistry[currentLevelIdx];
    levelInfoEl.innerText = `${i18n.t('level')} ${currentLevelIdx + 1}/${LevelRegistry.length}: ${level.name} (${level.cols}×${level.rows})`;
}

document.addEventListener('keydown', (event) => {
    if (document.querySelector('.modal.active')) return;
    if (/^[1-9]$/.test(event.key)) { handleDrop(Number(event.key) - 1); event.preventDefault(); }
});

document.getElementById('restartBtn').onclick = () => loadLevel(currentLevelIdx);
window.addEventListener('langChanged', () => { setStatus(statusKey); updateLevelInfo(); render(); });
if (LevelRegistry.length > 0) loadLevel(Progress.startLevel());
