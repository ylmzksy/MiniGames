const CELL = 60;

let currentLevelIdx = 0;
let state = null;
let playerSide = 'geese';
let aiSide = 'fox';
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
    state = FoxEngine.create(level);
    playerSide = level.side;
    aiSide = level.side === 'fox' ? 'geese' : 'fox';
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
    const lines = [];
    const points = [];
    for (let r = 0; r < 7; r++) for (let c = 0; c < 7; c++) {
        if (!FoxEngine.valid(r, c)) continue;
        FoxEngine.dirs(r, c).forEach(([dr, dc]) => {
            const nr = r + dr, nc = c + dc;
            if (!FoxEngine.valid(nr, nc) || nr < r || (nr === r && nc < c)) return;
            lines.push(`<line x1="${c * CELL + 30}" y1="${r * CELL + 30}" x2="${nc * CELL + 30}" y2="${nr * CELL + 30}"></line>`);
        });
    }
    const targetSet = new Set(targets.map(t => `${t[0]},${t[1]}`));
    for (let r = 0; r < 7; r++) for (let c = 0; c < 7; c++) {
        if (!FoxEngine.valid(r, c)) continue;
        const piece = state.board[r][c];
        const key = `${r},${c}`;
        const isSel = selected && selected[0] === r && selected[1] === c;
        const isLast = lastMove && ((lastMove.from[0] === r && lastMove.from[1] === c) || (lastMove.to[0] === r && lastMove.to[1] === c));
        const cls = ['point', piece === 'F' ? 'fox' : piece === 'G' ? 'goose' : 'empty', isSel ? 'selected' : '', targetSet.has(key) ? 'target' : '', isLast ? 'last' : '',
            piece && pieceSide(piece) === playerSide && !isAiTurn && !isOver ? 'mine' : ''].join(' ');
        const x = c * CELL + 30, y = r * CELL + 30;
        points.push(`<g class="${cls}" onclick="handlePoint(${r}, ${c})"><circle class="spot" cx="${x}" cy="${y}" r="${piece ? 22 : 9}"></circle>${piece ? `<text x="${x}" y="${y + 8}" text-anchor="middle">${piece === 'F' ? '🦊' : '🪿'}</text>` : ''}</g>`);
    }
    boardEl.innerHTML = `<svg viewBox="-6 -6 ${S + 12} ${S + 12}" role="img">${lines.join('')}${points.join('')}</svg>`;
    countersEl.innerText = `${i18n.t('geese_left')}: ${FoxEngine.geeseCount(state)} · ${i18n.t('captured')}: ${state.captured} · ${i18n.t('moves')}: ${moves}`;
}

function pieceSide(piece) {
    return piece === 'F' ? 'fox' : 'geese';
}

window.handlePoint = (r, c) => {
    if (isAiTurn || isOver || state.turn !== playerSide) return;
    const piece = state.board[r][c];
    if (piece && pieceSide(piece) === playerSide) {
        if (selected && selected[0] === r && selected[1] === c) { selected = null; targets = []; }
        else {
            selected = [r, c];
            targets = FoxEngine.moves(state).filter(m => m.from[0] === r && m.from[1] === c).map(m => m.to);
        }
        render();
        return;
    }
    if (!selected) return;
    // several jump chains may end on the same point: take the one capturing most
    const options = FoxEngine.moves(state).filter(m => m.from[0] === selected[0] && m.from[1] === selected[1] && m.to[0] === r && m.to[1] === c);
    if (!options.length) return;
    const move = options.reduce((b, m) => m.captures.length > b.captures.length ? m : b, options[0]);
    playMove(move);
};

function playMove(move) {
    state = FoxEngine.apply(state, move);
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
    const move = difficulty === 'master' ? FoxEngine.getMasterMove(state, level.depth) : FoxEngine.getNoviceMove(state);
    isAiTurn = false;
    if (!move) { checkEnd(); return; }
    state = FoxEngine.apply(state, move);
    lastMove = move;
    moves++;
    render();
    if (checkEnd()) return;
    setStatus('status_your_turn');
}

function checkEnd() {
    const w = FoxEngine.winner(state);
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
    levelInfoEl.innerText = `${i18n.t('level')} ${currentLevelIdx + 1}/${LevelRegistry.length}: ${level.name} · ${i18n.t(level.side === 'fox' ? 'you_fox' : 'you_geese')}`;
}

document.getElementById('restartBtn').onclick = () => loadLevel(currentLevelIdx);

window.addEventListener('langChanged', () => {
    setStatus(statusKey);
    updateLevelInfo();
    render();
});

// Initial Load
if (LevelRegistry.length > 0) loadLevel(Progress.startLevel());
