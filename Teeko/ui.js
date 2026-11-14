const PLAYER = 'blue';
const AI = 'red';

let currentLevelIdx = 0;
let state = null;
let selected = null;
let isAiTurn = false;
let isOver = false;
let gameId = 0;
let statusKey = '';
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
    state = TeekoEngine.create();
    selected = null;
    isAiTurn = false;
    isOver = false;
    lastMove = null;
    updateLevelInfo();
    setStatus('status_place');
    render();
}

function render() {
    const win = state.winner && state.winner !== 'draw' ? TeekoEngine.winningQuad(state, state.winner) : null;
    const winSet = new Set((win || []).map(([r, c]) => `${r},${c}`));
    const placing = TeekoEngine.placing(state);
    const targets = new Set(!isOver && !isAiTurn
        ? (placing ? TeekoEngine.moves(state) : selected ? TeekoEngine.movesFrom(state, ...selected) : []).map(m => `${m.to[0]},${m.to[1]}`)
        : []);
    const cells = [];
    for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 5; c++) {
            const v = state.board[r][c];
            const classes = ['cell', selected && selected[0] === r && selected[1] === c ? 'selected' : '',
                targets.has(`${r},${c}`) ? 'target' : '', winSet.has(`${r},${c}`) ? 'win' : '',
                lastMove && lastMove.to[0] === r && lastMove.to[1] === c ? 'last' : '',
                v === PLAYER && !placing && !isOver && !isAiTurn ? 'mine' : ''].join(' ');
            cells.push(`<div class="${classes}" onclick="handleCell(${r}, ${c})"><span class="dot"></span>${v ? `<span class="stone ${v}"></span>` : ''}</div>`);
        }
    }
    boardEl.innerHTML = cells.join('');
    countersEl.innerText = `${i18n.t('in_hand')}: ${state.hands.blue} / ${state.hands.red} · ${i18n.t('moves')}: ${state.plies}`;
}

window.handleCell = (r, c) => {
    if (isAiTurn || isOver) return;
    if (TeekoEngine.placing(state)) {
        if (state.board[r][c]) return;
        playMove({ to: [r, c] });
        return;
    }
    if (state.board[r][c] === PLAYER) {
        selected = selected && selected[0] === r && selected[1] === c ? null : [r, c];
        render();
        return;
    }
    if (!selected) return;
    const move = TeekoEngine.movesFrom(state, ...selected).find(m => m.to[0] === r && m.to[1] === c);
    if (move) playMove(move);
};

function playMove(move) {
    state = TeekoEngine.apply(state, move);
    lastMove = move;
    selected = null;
    render();
    if (checkEnd()) return;
    isAiTurn = true;
    setStatus('status_ai');
    render();
    const moveGameId = gameId;
    setTimeout(() => processAiTurn(moveGameId), 400);
}

function processAiTurn(moveGameId) {
    if (moveGameId !== gameId || isOver) return;
    const difficulty = document.getElementById('difficulty').value;
    const depth = LevelRegistry[currentLevelIdx].depth;
    const move = difficulty === 'master' ? TeekoEngine.getMasterMove(state, depth) : TeekoEngine.getNoviceMove(state);
    state = TeekoEngine.apply(state, move);
    lastMove = move;
    isAiTurn = false;
    render();
    if (checkEnd()) return;
    setStatus(TeekoEngine.placing(state) ? 'status_place' : 'status_your_turn');
}

function checkEnd() {
    if (!state.winner) return false;
    isOver = true;
    isAiTurn = false;
    render();
    if (state.winner === PLAYER) {
        setStatus('win');
        Progress.markSolved(currentLevelIdx);
        const winGameId = gameId;
        setTimeout(() => { if (winGameId === gameId) nextLevel(); }, 2200);
    } else if (state.winner === 'draw') setStatus('draw');
    else setStatus('lose');
    return true;
}

function nextLevel() {
    if (currentLevelIdx + 1 < LevelRegistry.length) loadLevel(currentLevelIdx + 1);
    else setStatus('all_levels_cleared');
}

function setStatus(key) { statusKey = key; statusEl.innerText = i18n.t(key); }

function updateLevelInfo() {
    const level = LevelRegistry[currentLevelIdx];
    levelInfoEl.innerText = `${i18n.t('level')} ${currentLevelIdx + 1}/${LevelRegistry.length}: ${level.name}`;
}

document.getElementById('restartBtn').onclick = () => loadLevel(currentLevelIdx);
window.addEventListener('langChanged', () => { setStatus(statusKey); updateLevelInfo(); render(); });
if (LevelRegistry.length > 0) loadLevel(Progress.startLevel());
