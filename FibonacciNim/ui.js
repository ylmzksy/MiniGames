const PLAYER = 'blue';
const AI = 'red';

let currentLevelIdx = 0;
let state = null;
let amount = 1;
let isAiTurn = false;
let isOver = false;
let gameId = 0; // Bumped on every level load so a pending AI move from an old game is dropped
let statusKey = '';
let statusParams = {};
let history = [];  // [{ owner, n }]

const pileEl = document.getElementById('pile');
const amountEl = document.getElementById('amount');
const limitEl = document.getElementById('limit');
const statusEl = document.getElementById('status');
const levelInfoEl = document.getElementById('level-info');
const historyEl = document.getElementById('history');
const takeBtn = document.getElementById('takeBtn');

function loadLevel(idx) {
    const level = LevelRegistry[idx];
    if (!level) return;

    currentLevelIdx = idx;
    Progress.setCurrent(idx);
    gameId++;
    state = FibonacciEngine.create(level);
    amount = 1;
    isAiTurn = false;
    isOver = false;
    history = [];
    updateLevelInfo();
    setStatus('status_your_turn');
    render();
}

function render() {
    const max = FibonacciEngine.maxTake(state);
    amount = Math.max(1, Math.min(amount, max || 1));
    pileEl.innerHTML = Array.from({ length: state.pile }, (_, i) => `<span class="coin ${i >= state.pile - amount && !isAiTurn && !isOver ? 'picked' : ''}"></span>`).join('');
    amountEl.innerText = amount;
    limitEl.innerText = i18n.t('limit', { n: max, pile: state.pile });
    const busy = isAiTurn || isOver;
    takeBtn.disabled = busy;
    document.getElementById('lessBtn').disabled = busy || amount <= 1;
    document.getElementById('moreBtn').disabled = busy || amount >= max;
    historyEl.innerHTML = history.map(h => `<span class="take ${h.owner}">${h.n}</span>`).join('');
}

window.changeAmount = (d) => {
    if (isAiTurn || isOver) return;
    amount = Math.max(1, Math.min(amount + d, FibonacciEngine.maxTake(state)));
    render();
};

window.takeCoins = () => {
    if (isAiTurn || isOver) return;
    const n = amount;
    if (n < 1 || n > FibonacciEngine.maxTake(state)) return;
    state = FibonacciEngine.apply(state, n);
    history.push({ owner: PLAYER, n });
    render();
    if (checkEnd(PLAYER)) return;

    isAiTurn = true;
    setStatus('status_ai');
    render();
    const moveGameId = gameId;
    setTimeout(() => processAiTurn(moveGameId), 600);
};

function processAiTurn(moveGameId) {
    if (moveGameId !== gameId || isOver) return;

    const difficulty = document.getElementById('difficulty').value;
    const n = difficulty === 'master' ? FibonacciEngine.getMasterMove(state) : FibonacciEngine.getNoviceMove(state);
    state = FibonacciEngine.apply(state, n);
    history.push({ owner: AI, n });
    isAiTurn = false;
    amount = 1;
    render();
    if (checkEnd(AI)) return;
    setStatus('status_ai_took', { n });
}

// Whoever takes the last coin wins
function checkEnd(mover) {
    if (state.pile > 0) return false;
    isOver = true;
    isAiTurn = false;
    render();
    if (mover === PLAYER) {
        setStatus('win');
        Progress.markSolved(currentLevelIdx);
        const winGameId = gameId;
        setTimeout(() => {
            if (winGameId === gameId) nextLevel();
        }, 2200);
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

function setStatus(key, params = {}) {
    statusKey = key;
    statusParams = params;
    statusEl.innerText = i18n.t(key, params);
}

function updateLevelInfo() {
    const level = LevelRegistry[currentLevelIdx];
    levelInfoEl.innerText = `${i18n.t('level')} ${currentLevelIdx + 1}/${LevelRegistry.length}: ${level.name} (${level.coins})`;
}

document.addEventListener('keydown', (event) => {
    if (document.querySelector('.modal.active')) return;
    if (event.key === 'ArrowUp' || event.key === '+') changeAmount(1);
    else if (event.key === 'ArrowDown' || event.key === '-') changeAmount(-1);
    else if (event.key === 'Enter') takeCoins();
    else return;
    event.preventDefault();
});

document.getElementById('restartBtn').onclick = () => loadLevel(currentLevelIdx);

window.addEventListener('langChanged', () => {
    setStatus(statusKey, statusParams);
    updateLevelInfo();
    render();
});

// Initial Load
if (LevelRegistry.length > 0) loadLevel(Progress.startLevel());
