const CELL = 60;

let currentLevelIdx = 0;
let state = null;
let playerSide = 'defenders';
let aiSide = 'attackers';
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
    state = TaflEngine.create(level);
    playerSide = level.side;
    aiSide = level.side === 'attackers' ? 'defenders' : 'attackers';
    selected = null;
    targets = [];
    isAiTurn = false;
    isOver = false;
    moves = 0;
    lastMove = null;
    updateLevelInfo();
    render();
    if (state.turn === playerSide) setStatus('status_your_turn');
    else scheduleAi();
}

function render() {
    const S = 7 * CELL;
    const targetSet = new Set(targets.map(t => `${t[0]},${t[1]}`));
    const cells = [];
    for (let r = 0; r < 7; r++) for (let c = 0; c < 7; c++) {
        const piece = state.board[r][c];
        const key = `${r},${c}`;
        const isSel = selected && selected[0] === r && selected[1] === c;
        const isLast = lastMove && ((lastMove.from[0] === r && lastMove.from[1] === c) || (lastMove.to[0] === r && lastMove.to[1] === c));
        const cls = ['cell', (r + c) % 2 ? 'dark' : 'light', TaflEngine.isCorner(r, c) || TaflEngine.isThrone(r, c) ? 'restricted' : '',
            piece ? (piece === 'A' ? 'attacker' : piece === 'K' ? 'king' : 'defender') : '',
            isSel ? 'selected' : '', targetSet.has(key) ? 'target' : '', isLast ? 'last' : '',
            piece && TaflEngine.side(piece) === playerSide && !isAiTurn && !isOver ? 'mine' : ''].join(' ');
        const x = c * CELL, y = r * CELL;
        const glyph = piece === 'K' ? `<text x="${x + 30}" y="${y + 40}" text-anchor="middle">♔</text>` : '';
        cells.push(`<g class="${cls}" onclick="handleCell(${r}, ${c})"><rect x="${x}" y="${y}" width="${CELL}" height="${CELL}"></rect>${piece ? `<circle cx="${x + 30}" cy="${y + 30}" r="22"></circle>` : ''}${glyph}${targetSet.has(key) ? `<circle class="dot" cx="${x + 30}" cy="${y + 30}" r="9"></circle>` : ''}</g>`);
    }
    boardEl.innerHTML = `<svg viewBox="0 0 ${S} ${S}" role="img">${cells.join('')}</svg>`;
    let attackers = 0, defenders = 0;
    state.board.forEach(row => row.forEach(v => { if (v === 'A') attackers++; if (v === 'D') defenders++; }));
    countersEl.innerText = `${i18n.t('attackers')}: ${attackers} · ${i18n.t('defenders')}: ${defenders} · ${i18n.t('moves')}: ${moves}`;
}

window.handleCell = (r, c) => {
    if (isAiTurn || isOver || state.turn !== playerSide) return;
    const piece = state.board[r][c];
    if (piece && TaflEngine.side(piece) === playerSide) {
        if (selected && selected[0] === r && selected[1] === c) { selected = null; targets = []; }
        else {
            selected = [r, c];
            targets = TaflEngine.moves(state).filter(m => m.from[0] === r && m.from[1] === c).map(m => m.to);
        }
        render();
        return;
    }
    if (!selected) return;
    const move = TaflEngine.moves(state).find(m => m.from[0] === selected[0] && m.from[1] === selected[1] && m.to[0] === r && m.to[1] === c);
    if (move) playMove(move);
};

function playMove(move) {
    state = TaflEngine.apply(state, move);
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
    const move = difficulty === 'master' ? TaflEngine.getMasterMove(state, level.depth) : TaflEngine.getNoviceMove(state);
    isAiTurn = false;
    if (!move) { checkEnd(); return; }
    state = TaflEngine.apply(state, move);
    lastMove = move;
    moves++;
    render();
    if (checkEnd()) return;
    setStatus('status_your_turn');
}

function checkEnd() {
    const w = TaflEngine.winner(state);
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
    levelInfoEl.innerText = `${i18n.t('level')} ${currentLevelIdx + 1}/${LevelRegistry.length}: ${level.name} · ${i18n.t(level.side === 'attackers' ? 'you_attackers' : 'you_defenders')}`;
}

document.getElementById('restartBtn').onclick = () => loadLevel(currentLevelIdx);

window.addEventListener('langChanged', () => {
    setStatus(statusKey);
    updateLevelInfo();
    render();
});

// Initial Load
if (LevelRegistry.length > 0) loadLevel(Progress.startLevel());
