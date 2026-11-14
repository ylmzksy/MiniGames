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
    state = LoaEngine.create(level);
    selected = null;
    isAiTurn = false;
    isOver = false;
    lastMove = null;
    updateLevelInfo();
    setStatus('status_your_turn');
    render();
}

function render() {
    const n = state.size;
    boardEl.style.gridTemplateColumns = `repeat(${n}, 1fr)`;
    boardEl.style.maxWidth = `${n * 56}px`;
    const targets = new Set(selected ? LoaEngine.movesFrom(state, ...selected).map(m => `${m.to[0]},${m.to[1]}`) : []);
    const cells = [];
    for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
            const v = state.board[r][c];
            const classes = ['cell', (r + c) % 2 ? 'dark' : 'light',
                selected && selected[0] === r && selected[1] === c ? 'selected' : '',
                targets.has(`${r},${c}`) ? 'target' : '',
                lastMove && ((lastMove.from[0] === r && lastMove.from[1] === c) || (lastMove.to[0] === r && lastMove.to[1] === c)) ? 'last' : '',
                v === PLAYER && !isOver && !isAiTurn ? 'mine' : ''].join(' ');
            cells.push(`<div class="${classes}" onclick="handleCell(${r}, ${c})">${v ? `<span class="stone ${v}"></span>` : ''}</div>`);
        }
    }
    boardEl.innerHTML = cells.join('');
    countersEl.innerText = `${i18n.t('groups')}: ${LoaEngine.groups(state, PLAYER)} · ${i18n.t('ai_groups')}: ${LoaEngine.groups(state, AI)} · ${i18n.t('moves')}: ${state.plies}`;
}

window.handleCell = (r, c) => {
    if (isAiTurn || isOver) return;
    if (state.board[r][c] === PLAYER) {
        selected = selected && selected[0] === r && selected[1] === c ? null : [r, c];
        render();
        return;
    }
    if (!selected) return;
    const move = LoaEngine.movesFrom(state, ...selected).find(m => m.to[0] === r && m.to[1] === c);
    if (!move) return;
    playMove(move);
};

function playMove(move) {
    state = LoaEngine.apply(state, move);
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
    const move = difficulty === 'master' ? LoaEngine.getMasterMove(state, depth) : LoaEngine.getNoviceMove(state);
    state = LoaEngine.apply(state, move);
    lastMove = move;
    isAiTurn = false;
    render();
    if (checkEnd()) return;
    setStatus('status_your_turn');
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
    } else if (state.winner === 'draw') {
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

function setStatus(key) { statusKey = key; statusEl.innerText = i18n.t(key); }

function updateLevelInfo() {
    const level = LevelRegistry[currentLevelIdx];
    levelInfoEl.innerText = `${i18n.t('level')} ${currentLevelIdx + 1}/${LevelRegistry.length}: ${level.name} (${level.size}×${level.size})`;
}

document.getElementById('restartBtn').onclick = () => loadLevel(currentLevelIdx);
window.addEventListener('langChanged', () => { setStatus(statusKey); updateLevelInfo(); render(); });
if (LevelRegistry.length > 0) loadLevel(Progress.startLevel());
