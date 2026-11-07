const PLAYER = 1;
const AI = 2;

let currentLevelIdx = 0;
let board = null;
let pending = null;   // [r, c] of the marble placed but not yet rotated
let isAiTurn = false;
let isOver = false;
let gameId = 0;
let statusKey = '';
let moves = 0;

const boardEl = document.getElementById('game-board');
const statusEl = document.getElementById('status');
const levelInfoEl = document.getElementById('level-info');
const countersEl = document.getElementById('counters');
const rotateBtns = [...document.querySelectorAll('.rotations button')];

function loadLevel(idx) {
    const level = LevelRegistry[idx];
    if (!level) return;
    currentLevelIdx = idx;
    Progress.setCurrent(idx);
    gameId++;
    board = PentagoEngine.create();
    pending = null;
    isAiTurn = false;
    isOver = false;
    moves = 0;
    updateLevelInfo();
    setStatus('status_your_turn');
    render();
}

function render() {
    const win = PentagoEngine.winner(board);
    const winSet = new Set(win ? win.cells.map(c => c.join(',')) : []);
    const quads = [];
    for (let q = 0; q < 4; q++) {
        const r0 = q < 2 ? 0 : 3, c0 = q % 2 ? 3 : 0;
        const cells = [];
        for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
            const r = r0 + i, c = c0 + j;
            const v = board.cells[r][c];
            const isPending = pending && pending[0] === r && pending[1] === c;
            const classes = ['cell', v === PLAYER ? 'p1' : v === AI ? 'p2' : 'empty', isPending ? 'pending' : '',
                winSet.has(`${r},${c}`) ? 'win' : '', !v && !pending && !isAiTurn && !isOver ? 'free' : '',
                board.last && board.last.r === r && board.last.c === c && !pending ? '' : ''].join(' ');
            cells.push(`<div class="${classes}" data-r="${r}" data-c="${c}"><i></i></div>`);
        }
        quads.push(`<div class="quadrant ${board.last && board.last.q === q && !pending ? 'turned' : ''}" data-q="${q}">${cells.join('')}</div>`);
    }
    boardEl.innerHTML = quads.join('');
    rotateBtns.forEach(btn => { btn.disabled = !pending || isAiTurn || isOver; });
    countersEl.innerText = `${i18n.t('moves')}: ${moves}`;
}

boardEl.addEventListener('click', (event) => {
    const el = event.target.closest('.cell');
    if (el) handlePlace(Number(el.dataset.r), Number(el.dataset.c));
});

window.handlePlace = (r, c) => {
    if (isAiTurn || isOver) return;
    if (pending && pending[0] === r && pending[1] === c) { pending = null; setStatus('status_your_turn'); render(); return; }
    if (board.cells[r][c]) return;
    pending = [r, c];
    setStatus('status_rotate');
    render();
};

window.handleRotate = (q, dir) => {
    if (!pending || isAiTurn || isOver) return;
    board = PentagoEngine.apply(board, { r: pending[0], c: pending[1], q, dir }, PLAYER);
    pending = null;
    moves++;
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
    const move = difficulty === 'master' ? PentagoEngine.getMove(board, AI, level.depth, 900) : PentagoEngine.getNoviceMove(board, AI);
    board = PentagoEngine.apply(board, move, AI);
    moves++;
    isAiTurn = false;
    render();
    if (checkEnd()) return;
    setStatus('status_your_turn');
}

function checkEnd() {
    const win = PentagoEngine.winner(board);
    if (!win) return false;
    isOver = true;
    isAiTurn = false;
    render();
    if (win.who === PLAYER) {
        setStatus('win');
        Progress.markSolved(currentLevelIdx);
        const winGameId = gameId;
        setTimeout(() => { if (winGameId === gameId) nextLevel(); }, 2200);
    } else {
        setStatus(win.who === AI ? 'lose' : 'draw');
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
    levelInfoEl.innerText = `${i18n.t('level')} ${currentLevelIdx + 1}/${LevelRegistry.length}: ${level.name}`;
}

document.getElementById('restartBtn').onclick = () => loadLevel(currentLevelIdx);
window.addEventListener('langChanged', () => { setStatus(statusKey); updateLevelInfo(); render(); });
if (LevelRegistry.length > 0) loadLevel(Progress.startLevel());
