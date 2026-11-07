const PLAYER = 'blue';
const AI = 'red';

let currentLevelIdx = 0;
let state = null;
let isAiTurn = false;
let isOver = false;
let gameId = 0; // Bumped on every level load so a pending AI move from an old game is dropped
let statusKey = '';
let statusParams = {};
let history = [];

const pileEl = document.getElementById('pile');
const takesEl = document.getElementById('takes');
const statusEl = document.getElementById('status');
const levelInfoEl = document.getElementById('level-info');
const ruleEl = document.getElementById('rule');
const historyEl = document.getElementById('history');

function loadLevel(idx) {
    const level = LevelRegistry[idx];
    if (!level) return;

    currentLevelIdx = idx;
    Progress.setCurrent(idx);
    gameId++;
    state = SubtractionEngine.create(level);
    isAiTurn = false;
    isOver = false;
    history = [];
    updateLevelInfo();
    setStatus('status_your_turn');
    render();
}

function render() {
    pileEl.innerHTML = Array.from({ length: state.pile }, () => '<span class="counter"></span>').join('');
    const busy = isAiTurn || isOver;
    takesEl.innerHTML = state.takes.map(t => `<button class="primary" onclick="takeCounters(${t})" ${busy || t > state.pile ? 'disabled' : ''}>${i18n.t('take_n', { n: t })}</button>`).join('');
    ruleEl.innerText = `${i18n.t('allowed')}: ${state.takes.join(', ')} · ${i18n.t(state.misere ? 'rule_misere' : 'rule_normal')} · ${i18n.t('left')}: ${state.pile}`;
    historyEl.innerHTML = history.map(h => `<span class="take ${h.owner}">${h.n}</span>`).join('');
}

window.takeCounters = (n) => {
    if (isAiTurn || isOver || !SubtractionEngine.options(state).includes(n)) return;
    state = SubtractionEngine.apply(state, n);
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
    const n = difficulty === 'master' ? SubtractionEngine.getMasterMove(state) : SubtractionEngine.getNoviceMove(state);
    state = SubtractionEngine.apply(state, n);
    history.push({ owner: AI, n });
    isAiTurn = false;
    render();
    if (checkEnd(AI)) return;
    setStatus('status_ai_took', { n });
}

// Normal play: the last take wins. Misère: the last take loses.
// A player with no legal take loses.
function checkEnd(mover) {
    const other = mover === PLAYER ? AI : PLAYER;
    let winner = null;
    if (state.pile === 0) winner = state.misere ? other : mover;
    else if (SubtractionEngine.options(state).length === 0) winner = mover;
    if (!winner) return false;

    isOver = true;
    isAiTurn = false;
    render();
    if (winner === PLAYER) {
        setStatus(state.pile === 0 ? (state.misere ? 'win_misere' : 'win') : 'win_stuck');
        Progress.markSolved(currentLevelIdx);
        const winGameId = gameId;
        setTimeout(() => {
            if (winGameId === gameId) nextLevel();
        }, 2200);
    } else {
        setStatus(state.pile === 0 ? (state.misere ? 'lose_misere' : 'lose') : 'lose_stuck');
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
    levelInfoEl.innerText = `${i18n.t('level')} ${currentLevelIdx + 1}/${LevelRegistry.length}: ${level.name}`;
}

document.addEventListener('keydown', (event) => {
    if (document.querySelector('.modal.active')) return;
    if (/^[1-9]$/.test(event.key)) { takeCounters(Number(event.key)); event.preventDefault(); }
});

document.getElementById('restartBtn').onclick = () => loadLevel(currentLevelIdx);

window.addEventListener('langChanged', () => {
    setStatus(statusKey, statusParams);
    updateLevelInfo();
    render();
});

// Initial Load
if (LevelRegistry.length > 0) loadLevel(Progress.startLevel());
