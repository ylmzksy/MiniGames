let currentLevelIdx = 0;
let state = null;
let selected = null;
let isAiTurn = false;
let isOver = false;
let gameId = 0;
let statusKey = '';
let seen = new Map();  // position key -> times seen, for the repetition draw
let lastMove = null;
let moveCount = 0;

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
    state = MuTorereEngine.create();
    selected = null;
    isAiTurn = false;
    isOver = false;
    seen = new Map();
    lastMove = null;
    moveCount = 0;
    noteSeen();
    updateLevelInfo();
    setStatus('status_your_turn');
    render();
}

function noteSeen() {
    const k = MuTorereEngine.key(state);
    seen.set(k, (seen.get(k) || 0) + 1);
    return seen.get(k);
}

function point(i) {
    if (i === MuTorereEngine.CENTER) return [150, 150];
    const a = (Math.PI / 4) * i - Math.PI / 2;
    return [150 + Math.cos(a) * 110, 150 + Math.sin(a) * 110];
}

function render() {
    const targets = new Set(selected !== null && !isAiTurn && !isOver
        ? MuTorereEngine.moves(state, 'you').filter(m => m.from === selected).map(m => m.to) : []);
    const lines = [];
    for (let i = 0; i < 8; i++) {
        const [x1, y1] = point(i);
        const [x2, y2] = point((i + 1) % 8);
        const [cx, cy] = point(8);
        lines.push(`<line class="edge" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"></line>`);
        lines.push(`<line class="edge" x1="${x1}" y1="${y1}" x2="${cx}" y2="${cy}"></line>`);
    }
    const points = [];
    for (let i = 0; i < 9; i++) {
        const [x, y] = point(i);
        const v = state.board[i];
        const movable = !isAiTurn && !isOver && v === 'you' && MuTorereEngine.moves(state, 'you').some(m => m.from === i);
        const classes = ['point', v ? `stone ${v}` : 'empty', selected === i ? 'selected' : '', targets.has(i) ? 'target' : '',
            movable ? 'movable' : '', lastMove && lastMove.to === i ? 'last' : ''].join(' ');
        points.push(`<g class="${classes}" onclick="handlePoint(${i})"><circle cx="${x}" cy="${y}" r="${i === 8 ? 24 : 22}"></circle></g>`);
    }
    boardEl.innerHTML = `<svg viewBox="0 0 300 300" role="img">${lines.join('')}${points.join('')}</svg>`;
    countersEl.innerText = `${i18n.t('moves')}: ${moveCount}`;
}

window.handlePoint = (i) => {
    if (isAiTurn || isOver) return;
    if (state.board[i] === 'you') {
        selected = selected === i ? null : i;
        render();
        return;
    }
    if (selected === null) return;
    const move = MuTorereEngine.moves(state, 'you').find(m => m.from === selected && m.to === i);
    if (!move) return;
    selected = null;
    playMove(move);
};

function playMove(move) {
    state = MuTorereEngine.apply(state, move);
    lastMove = move;
    moveCount++;
    render();
    if (checkEnd()) return;
    isAiTurn = true;
    setStatus('status_ai');
    const moveGameId = gameId;
    setTimeout(() => processAiTurn(moveGameId), 400);
}

function processAiTurn(moveGameId) {
    if (moveGameId !== gameId || isOver) return;
    const difficulty = document.getElementById('difficulty').value;
    const level = LevelRegistry[currentLevelIdx];
    const move = difficulty === 'master' ? MuTorereEngine.getMasterMove(state, level.strength, level.mistake || 0) : MuTorereEngine.getNoviceMove(state);
    state = MuTorereEngine.apply(state, move);
    lastMove = move;
    moveCount++;
    isAiTurn = false;
    render();
    if (checkEnd()) return;
    setStatus('status_your_turn');
}

function checkEnd() {
    const mover = state.turn;
    if (!MuTorereEngine.moves(state, mover).length) { endGame(mover === 'ai' ? 'you' : 'ai'); return true; }
    if (noteSeen() >= 3) { endGame('draw'); return true; }
    return false;
}

function endGame(result) {
    isOver = true;
    isAiTurn = false;
    render();
    const level = LevelRegistry[currentLevelIdx];
    if (result === 'you' || (result === 'draw' && level.drawSolves)) {
        setStatus(result === 'draw' ? 'draw_solved' : 'win');
        Progress.markSolved(currentLevelIdx);
        const winGameId = gameId;
        setTimeout(() => { if (winGameId === gameId) nextLevel(); }, 2200);
    } else if (result === 'draw') {
        setStatus('draw');
    } else {
        setStatus('lose');
    }
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

window.addEventListener('langChanged', () => {
    setStatus(statusKey);
    updateLevelInfo();
    render();
});

if (LevelRegistry.length > 0) loadLevel(Progress.startLevel());
