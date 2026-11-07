const PLAYER = 1;
const AI = 2;
const UNIT = 40; // SVG units between intersections

let currentLevelIdx = 0;
let board = null;
let isAiTurn = false;
let isOver = false;
let gameId = 0;
let statusKey = '';
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
    board = GomokuEngine.create(level.size);
    isAiTurn = false;
    isOver = false;
    moves = 0;
    updateLevelInfo();
    setStatus('status_your_turn');
    render();
}

function render() {
    const n = board.size;
    const size = (n + 1) * UNIT;
    const win = GomokuEngine.winner(board);
    const winSet = new Set(win ? win.cells.map(c => c.join(',')) : []);
    const lines = [];
    for (let i = 0; i < n; i++) {
        const p = (i + 1) * UNIT;
        lines.push(`<line class="grid" x1="${UNIT}" y1="${p}" x2="${n * UNIT}" y2="${p}"></line><line class="grid" x1="${p}" y1="${UNIT}" x2="${p}" y2="${n * UNIT}"></line>`);
    }
    const stones = [];
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
        const x = (c + 1) * UNIT, y = (r + 1) * UNIT;
        const v = board.cells[r][c];
        if (v) {
            const last = board.last && board.last[0] === r && board.last[1] === c;
            stones.push(`<circle class="stone ${v === PLAYER ? 'black' : 'white'} ${winSet.has(`${r},${c}`) ? 'win' : ''}" cx="${x}" cy="${y}" r="${UNIT * 0.44}"></circle>`);
            if (last) stones.push(`<circle class="mark" cx="${x}" cy="${y}" r="${UNIT * 0.12}"></circle>`);
        } else {
            stones.push(`<rect class="spot ${!isAiTurn && !isOver ? 'free' : ''}" x="${x - UNIT / 2}" y="${y - UNIT / 2}" width="${UNIT}" height="${UNIT}" data-r="${r}" data-c="${c}"></rect>`);
        }
    }
    boardEl.innerHTML = `<svg viewBox="0 0 ${size} ${size}" role="img"><rect class="wood" x="0" y="0" width="${size}" height="${size}"></rect>${lines.join('')}${stones.join('')}</svg>`;
    countersEl.innerText = `${i18n.t('moves')}: ${moves}`;
}

boardEl.addEventListener('click', (event) => {
    const el = event.target.closest('.spot');
    if (el) handlePlace(Number(el.dataset.r), Number(el.dataset.c));
});

window.handlePlace = (r, c) => {
    if (isAiTurn || isOver || board.cells[r][c]) return;
    board = GomokuEngine.place(board, r, c, PLAYER);
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
    const [r, c] = difficulty === 'master' ? GomokuEngine.getMove(board, AI, level.depth, 800) : GomokuEngine.getNoviceMove(board, AI);
    board = GomokuEngine.place(board, r, c, AI);
    moves++;
    isAiTurn = false;
    render();
    if (checkEnd()) return;
    setStatus('status_your_turn');
}

function checkEnd() {
    const win = GomokuEngine.winner(board);
    if (!win && !GomokuEngine.isFull(board)) return false;
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
    levelInfoEl.innerText = `${i18n.t('level')} ${currentLevelIdx + 1}/${LevelRegistry.length}: ${level.name} (${level.size}×${level.size})`;
}

document.getElementById('restartBtn').onclick = () => loadLevel(currentLevelIdx);
window.addEventListener('langChanged', () => { setStatus(statusKey); updateLevelInfo(); render(); });
if (LevelRegistry.length > 0) loadLevel(Progress.startLevel());
