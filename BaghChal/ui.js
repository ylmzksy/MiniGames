const CELL = 80;

let currentLevelIdx = 0;
let state = null;
let playerSide = 'goats';
let aiSide = 'tigers';
let selected = null;
let targets = [];
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
    state = BaghChalEngine.create(level);
    playerSide = level.side;
    aiSide = level.side === 'tigers' ? 'goats' : 'tigers';
    selected = null;
    targets = [];
    isAiTurn = false;
    isOver = false;
    moves = 0;
    lastMove = null;
    updateLevelInfo();
    render();
    if (state.turn === playerSide) setStatus(promptKey());
    else scheduleAi();
}

function promptKey() {
    return playerSide === 'goats' && state.toPlace > 0 ? 'status_place' : 'status_your_turn';
}

function render() {
    const S = 4 * CELL;
    const lines = [];
    for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) {
        BaghChalEngine.dirs(r, c).forEach(([dr, dc]) => {
            const nr = r + dr, nc = c + dc;
            if (!BaghChalEngine.valid(nr, nc) || nr < r || (nr === r && nc < c)) return;
            lines.push(`<line x1="${c * CELL}" y1="${r * CELL}" x2="${nc * CELL}" y2="${nr * CELL}"></line>`);
        });
    }
    const placing = state.turn === 'goats' && state.toPlace > 0;
    const targetSet = new Set(targets.map(t => `${t[0]},${t[1]}`));
    const points = [];
    for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) {
        const piece = state.board[r][c];
        const key = `${r},${c}`;
        const isSel = selected && selected[0] === r && selected[1] === c;
        const isLast = lastMove && ((lastMove.place && lastMove.place[0] === r && lastMove.place[1] === c) || (lastMove.to && lastMove.to[0] === r && lastMove.to[1] === c));
        const canPlace = placing && !piece && playerSide === 'goats' && !isAiTurn && !isOver;
        const cls = ['point', piece === 'T' ? 'tiger' : piece === 'G' ? 'goat' : 'empty', isSel ? 'selected' : '', targetSet.has(key) || canPlace ? 'target' : '', isLast ? 'last' : '',
            piece && pieceSide(piece) === playerSide && !isAiTurn && !isOver && !placing ? 'mine' : ''].join(' ');
        const x = c * CELL, y = r * CELL;
        points.push(`<g class="${cls}" onclick="handlePoint(${r}, ${c})"><circle class="spot" cx="${x}" cy="${y}" r="${piece ? 26 : 10}"></circle>${piece ? `<text x="${x}" y="${y + 9}" text-anchor="middle">${piece === 'T' ? '🐯' : '🐐'}</text>` : ''}</g>`);
    }
    boardEl.innerHTML = `<svg viewBox="-40 -40 ${S + 80} ${S + 80}" role="img">${lines.join('')}${points.join('')}</svg>`;
    countersEl.innerText = `${i18n.t('to_place')}: ${state.toPlace} · ${i18n.t('captured')}: ${state.captured}/5 · ${i18n.t('moves')}: ${moves}`;
}

function pieceSide(piece) {
    return piece === 'T' ? 'tigers' : 'goats';
}

window.handlePoint = (r, c) => {
    if (isAiTurn || isOver || state.turn !== playerSide) return;
    const piece = state.board[r][c];
    if (playerSide === 'goats' && state.toPlace > 0) {
        if (!piece) playMove({ place: [r, c] });
        return;
    }
    if (piece && pieceSide(piece) === playerSide) {
        if (selected && selected[0] === r && selected[1] === c) { selected = null; targets = []; }
        else {
            selected = [r, c];
            targets = BaghChalEngine.moves(state).filter(m => m.from[0] === r && m.from[1] === c).map(m => m.to);
        }
        render();
        return;
    }
    if (!selected) return;
    const move = BaghChalEngine.moves(state).find(m => m.from && m.from[0] === selected[0] && m.from[1] === selected[1] && m.to[0] === r && m.to[1] === c);
    if (move) playMove(move);
};

function playMove(move) {
    state = BaghChalEngine.apply(state, move);
    lastMove = move;
    selected = null;
    targets = [];
    moves++;
    render();
    if (checkEnd()) return;
    scheduleAi();
}

function scheduleAi() {
    isAiTurn = true;
    setStatus('status_ai');
    render();
    const moveGameId = gameId;
    setTimeout(() => processAiTurn(moveGameId), 450);
}

function processAiTurn(moveGameId) {
    if (moveGameId !== gameId || isOver) return;
    const level = LevelRegistry[currentLevelIdx];
    const difficulty = document.getElementById('difficulty').value;
    const move = difficulty === 'master' ? BaghChalEngine.getMasterMove(state, level.depth) : BaghChalEngine.getNoviceMove(state);
    isAiTurn = false;
    if (!move) { checkEnd(); return; }
    state = BaghChalEngine.apply(state, move);
    lastMove = move;
    moves++;
    render();
    if (checkEnd()) return;
    setStatus(promptKey());
}

function checkEnd() {
    const w = BaghChalEngine.winner(state);
    if (!w) return false;
    isOver = true;
    isAiTurn = false;
    render();
    if (w === playerSide) {
        setStatus('win');
        Progress.markSolved(currentLevelIdx);
        const winGameId = gameId;
        setTimeout(() => { if (winGameId === gameId) nextLevel(); }, 2200);
    } else if (w === 'draw') {
        setStatus('draw');
    } else {
        setStatus('lose');
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
    levelInfoEl.innerText = `${i18n.t('level')} ${currentLevelIdx + 1}/${LevelRegistry.length}: ${level.name} · ${i18n.t(level.side === 'tigers' ? 'you_tigers' : 'you_goats')}`;
}

document.getElementById('restartBtn').onclick = () => loadLevel(currentLevelIdx);

window.addEventListener('langChanged', () => {
    setStatus(statusKey);
    updateLevelInfo();
    render();
});

// Initial Load
if (LevelRegistry.length > 0) loadLevel(Progress.startLevel());
