const PLAYER = 1;
const AI = 2;

let currentLevelIdx = 0;
let state = null;
let isAiTurn = false;
let isOver = false;
let gameId = 0;
let statusKey = '';
let highlight = [];

const board = document.getElementById('game-board');
const statusEl = document.getElementById('status');
const levelInfoEl = document.getElementById('level-info');

function loadLevel(idx) {
    const level = LevelRegistry[idx];
    if (!level) return;
    currentLevelIdx = idx;
    Progress.setCurrent(idx);
    gameId++;
    state = TttEngine.create(level);
    isAiTurn = false;
    isOver = false;
    highlight = [];
    updateLevelInfo();
    setStatus(level.misere ? 'status_your_turn_misere' : 'status_your_turn');
    render();
}

function render() {
    board.style.gridTemplateColumns = `repeat(${state.size}, 1fr)`;
    board.style.maxWidth = `${state.size * 70}px`;
    board.innerHTML = state.board.map((v, i) => {
        const classes = ['cell', v === PLAYER ? 'x' : v === AI ? 'o' : (isAiTurn || isOver ? '' : 'free'), highlight.includes(i) ? 'hit' : ''].join(' ');
        return `<div class="${classes}" onclick="handleCell(${i})">${v === PLAYER ? 'X' : v === AI ? 'O' : ''}</div>`;
    }).join('');
}

window.handleCell = (i) => {
    if (isAiTurn || isOver || state.board[i] !== 0) return;
    state.board[i] = PLAYER;
    render();
    if (checkEnd(PLAYER)) return;
    isAiTurn = true;
    setStatus('status_ai');
    render();
    const moveGameId = gameId;
    setTimeout(() => processAiTurn(moveGameId), 400);
};

function processAiTurn(moveGameId) {
    if (moveGameId !== gameId || isOver) return;
    const difficulty = document.getElementById('difficulty').value;
    const i = difficulty === 'master' ? TttEngine.getMasterMove(state) : TttEngine.getNoviceMove(state);
    state.board[i] = AI;
    isAiTurn = false;
    render();
    if (checkEnd(AI)) return;
    setStatus(state.misere ? 'status_your_turn_misere' : 'status_your_turn');
    render();
}

function checkEnd(p) {
    const o = TttEngine.outcome(state, p);
    if (o === null) return false;
    isOver = true;
    isAiTurn = false;
    highlight = TttEngine.lineOf(state, p) || [];
    render();
    if (o === 'draw') { setStatus('draw'); return true; }
    const playerWins = (o === 'win') === (p === PLAYER);
    if (playerWins) {
        setStatus(state.misere ? 'win_misere' : 'win');
        Progress.markSolved(currentLevelIdx);
        const winGameId = gameId;
        setTimeout(() => { if (winGameId === gameId) nextLevel(); }, 2200);
    } else {
        setStatus(state.misere ? 'lose_misere' : 'lose');
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
    levelInfoEl.innerText = `${i18n.t('level')} ${currentLevelIdx + 1}/${LevelRegistry.length}: ${level.name} (${level.size}×${level.size}, ${i18n.t('in_a_row', { n: level.win })})`;
}

document.getElementById('restartBtn').onclick = () => loadLevel(currentLevelIdx);
window.addEventListener('langChanged', () => { setStatus(statusKey); updateLevelInfo(); render(); });
if (LevelRegistry.length > 0) loadLevel(Progress.startLevel());
