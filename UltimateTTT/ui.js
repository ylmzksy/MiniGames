const PLAYER = 1;
const AI = 2;

let currentLevelIdx = 0;
let state = null;
let isAiTurn = false;
let isOver = false;
let gameId = 0;
let statusKey = '';

const board = document.getElementById('game-board');
const statusEl = document.getElementById('status');
const levelInfoEl = document.getElementById('level-info');

function loadLevel(idx) {
    const level = LevelRegistry[idx];
    if (!level) return;
    currentLevelIdx = idx;
    Progress.setCurrent(idx);
    gameId++;
    state = UltEngine.create();
    isAiTurn = false;
    isOver = false;
    updateLevelInfo();
    setStatus('status_your_turn');
    render();
}

function render() {
    const mark = v => v === PLAYER ? 'X' : v === AI ? 'O' : '';
    board.innerHTML = state.cells.map((cells, b) => {
        const active = !isOver && !isAiTurn && !state.won[b] && (state.active === null || state.active === b);
        const w = state.won[b];
        const inner = cells.map((v, c) => {
            const last = state.last && state.last[0] === b && state.last[1] === c;
            const cls = ['cell', v === PLAYER ? 'x' : v === AI ? 'o' : (active ? 'free' : ''), last ? 'last' : ''].join(' ');
            return `<div class="${cls}" onclick="handleCell(${b}, ${c})">${mark(v)}</div>`;
        }).join('');
        const overlay = w === PLAYER || w === AI ? `<div class="overlay ${w === PLAYER ? 'x' : 'o'}">${mark(w)}</div>` : w === 3 ? '<div class="overlay full"></div>' : '';
        return `<div class="small ${active ? 'active' : ''} ${w ? 'done' : ''}">${inner}${overlay}</div>`;
    }).join('');
}

window.handleCell = (b, c) => {
    if (isAiTurn || isOver) return;
    if (!UltEngine.moves(state).some(([mb, mc]) => mb === b && mc === c)) return;
    state = UltEngine.apply(state, [b, c]);
    render();
    if (checkEnd()) return;
    isAiTurn = true;
    setStatus('status_ai');
    render();
    const moveGameId = gameId;
    setTimeout(() => processAiTurn(moveGameId), 350);
};

function processAiTurn(moveGameId) {
    if (moveGameId !== gameId || isOver) return;
    const difficulty = document.getElementById('difficulty').value;
    const depth = LevelRegistry[currentLevelIdx].depth;
    const m = difficulty === 'master' ? UltEngine.getMasterMove(state, depth) : UltEngine.getNoviceMove(state);
    state = UltEngine.apply(state, m);
    isAiTurn = false;
    render();
    if (checkEnd()) return;
    setStatus(state.active === null ? 'status_any_board' : 'status_your_turn');
    render();
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
    } else {
        setStatus(state.winner === AI ? 'lose' : 'draw');
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
    levelInfoEl.innerText = `${i18n.t('level')} ${currentLevelIdx + 1}/${LevelRegistry.length}: ${level.name}`;
}

document.getElementById('restartBtn').onclick = () => loadLevel(currentLevelIdx);
window.addEventListener('langChanged', () => { setStatus(statusKey); updateLevelInfo(); render(); });
if (LevelRegistry.length > 0) loadLevel(Progress.startLevel());
