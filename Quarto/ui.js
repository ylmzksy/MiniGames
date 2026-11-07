let currentLevelIdx = 0;
let state = null;
let phase = 'choose';   // 'choose': pick a piece for the AI; 'place': put the handed piece on the board
let handed = null;      // piece the player must place
let isAiTurn = false;
let isOver = false;
let gameId = 0;
let statusKey = '';
let winLine = null;
let moves = 0;

const boardEl = document.getElementById('game-board');
const trayEl = document.getElementById('tray');
const statusEl = document.getElementById('status');
const levelInfoEl = document.getElementById('level-info');
const countersEl = document.getElementById('counters');

function loadLevel(idx) {
    const level = LevelRegistry[idx];
    if (!level) return;

    currentLevelIdx = idx;
    Progress.setCurrent(idx);
    gameId++;
    state = QuartoEngine.create();
    phase = 'choose';
    handed = null;
    isAiTurn = false;
    isOver = false;
    winLine = null;
    moves = 0;
    updateLevelInfo();
    setStatus('status_choose');
    render();
}

function pieceHtml(piece, extra = '') {
    const tall = piece & 1 ? 'tall' : 'short';
    const dark = piece & 2 ? 'dark' : 'light';
    const round = piece & 4 ? 'round' : 'square';
    const hollow = piece & 8 ? 'hollow' : 'solid';
    return `<span class="piece ${tall} ${dark} ${round} ${hollow} ${extra}"></span>`;
}

function render() {
    const line = new Set(winLine || []);
    boardEl.innerHTML = state.board.map((p, i) => {
        const classes = ['cell', p === null && phase === 'place' && !isAiTurn && !isOver ? 'free' : '', line.has(i) ? 'win' : ''].join(' ');
        return `<div class="${classes}" onclick="placeAt(${i})">${p === null ? '' : pieceHtml(p)}</div>`;
    }).join('');
    trayEl.innerHTML = state.remaining.map(p => {
        const isHanded = p === handed;
        const clickable = phase === 'choose' && !isAiTurn && !isOver && !isHanded;
        return `<button class="slot ${isHanded ? 'handed' : ''} ${clickable ? 'clickable' : ''}" ${clickable ? `onclick="choosePiece(${p})"` : 'disabled'}>${pieceHtml(p)}</button>`;
    }).join('');
    countersEl.innerText = `${i18n.t('moves')}: ${moves} · ${i18n.t('pieces_left')}: ${state.remaining.length}`;
}

// The player hands a piece to the AI
window.choosePiece = (piece) => {
    if (isAiTurn || isOver || phase !== 'choose' || !state.remaining.includes(piece) || piece === handed) return;
    isAiTurn = true;
    handed = piece;
    setStatus('status_ai');
    render();
    const moveGameId = gameId;
    setTimeout(() => processAiTurn(moveGameId, piece), 450);
};

// The player places the handed piece
window.placeAt = (cell) => {
    if (isAiTurn || isOver || phase !== 'place' || state.board[cell] !== null) return;
    state = QuartoEngine.place(state, cell, handed);
    handed = null;
    moves++;
    if (checkEnd()) return;
    phase = 'choose';
    setStatus('status_choose');
    render();
};

function processAiTurn(moveGameId, piece) {
    if (moveGameId !== gameId || isOver) return;
    const difficulty = document.getElementById('difficulty').value;
    const level = LevelRegistry[currentLevelIdx];
    const move = QuartoEngine.getMove(state, piece, difficulty, level.depth);
    state = QuartoEngine.place(state, move.cell, piece);
    moves++;
    isAiTurn = false;
    if (checkEnd()) return;
    handed = move.give;
    phase = 'place';
    setStatus('status_place');
    render();
}

function checkEnd() {
    winLine = QuartoEngine.winningLine(state.board);
    if (!winLine && !QuartoEngine.isFull(state.board)) return false;
    isOver = true;
    isAiTurn = false;
    render();
    if (!winLine) { setStatus('draw'); return true; }
    // the side that placed the last piece made the line
    if (phase === 'place') { // the player just placed
        setStatus('win');
        Progress.markSolved(currentLevelIdx);
        const winGameId = gameId;
        setTimeout(() => {
            if (winGameId === gameId) nextLevel();
        }, 2400);
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

if (LevelRegistry.length > 0) loadLevel(Progress.startLevel());
