const PLAYER = 0;
const AI = 1;

let currentLevelIdx = 0;
let state = null;
let isAiTurn = false;
let isOver = false;
let gameId = 0;
let statusKey = '';
let moves = 0;
let lastPit = null;   // the pit chosen in the latest move, for the highlight

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
    state = MancalaEngine.create(level);
    isAiTurn = false;
    isOver = false;
    moves = 0;
    lastPit = null;
    updateLevelInfo();
    setStatus('status_your_turn');
    render();
}

function seedsHtml(n) {
    if (n === 0) return '';
    if (n > 8) return `<span class="count">${n}</span>`;
    return `<span class="seeds">${'<i></i>'.repeat(n)}</span><span class="count">${n}</span>`;
}

function render() {
    const p = state.pits;
    const legal = new Set(!isAiTurn && !isOver ? MancalaEngine.moves(state, PLAYER) : []);
    const pit = (i, owner) => `<div class="pit ${owner} ${legal.has(i) ? 'legal' : ''} ${lastPit === i ? 'picked' : ''} ${state.last === i ? 'last' : ''}" onclick="handlePit(${i})">${seedsHtml(p[i])}</div>`;
    boardEl.innerHTML = `
        <div class="store ai"><span class="count">${p[13]}</span></div>
        <div class="rows">
            <div class="row ai">${[12, 11, 10, 9, 8, 7].map(i => pit(i, 'ai')).join('')}</div>
            <div class="row you">${[0, 1, 2, 3, 4, 5].map(i => pit(i, 'you')).join('')}</div>
        </div>
        <div class="store you"><span class="count">${p[6]}</span></div>
    `;
    countersEl.innerText = `${i18n.t('you')}: ${p[6]} · ${i18n.t('ai')}: ${p[13]} · ${i18n.t('moves')}: ${moves}`;
}

window.handlePit = (i) => {
    if (isAiTurn || isOver || state.turn !== PLAYER || !MancalaEngine.moves(state, PLAYER).includes(i)) return;
    play(i);
};

function play(pit) {
    const mover = state.turn;
    state = MancalaEngine.apply(state, pit);
    lastPit = pit;
    moves++;
    render();
    if (checkEnd()) return;

    if (state.turn === mover) {
        // extra turn for the same side
        if (mover === AI) scheduleAi(); else setStatus('status_extra');
        return;
    }
    if (state.turn === AI) scheduleAi(); else { isAiTurn = false; setStatus('status_your_turn'); render(); }
}

function scheduleAi() {
    isAiTurn = true;
    setStatus('status_ai');
    render();
    const moveGameId = gameId;
    setTimeout(() => processAiTurn(moveGameId), 500);
}

function processAiTurn(moveGameId) {
    if (moveGameId !== gameId || isOver) return;
    const difficulty = document.getElementById('difficulty').value;
    const depth = LevelRegistry[currentLevelIdx].depth;
    const pit = difficulty === 'master' ? MancalaEngine.getMasterMove(state, depth) : MancalaEngine.getNoviceMove(state);
    isAiTurn = false;
    if (pit === null) { checkEnd(); return; }
    play(pit);
}

function checkEnd() {
    if (!state.over) return false;
    isOver = true;
    isAiTurn = false;
    render();
    if (state.winner === PLAYER) {
        setStatus('win');
        Progress.markSolved(currentLevelIdx);
        const winGameId = gameId;
        setTimeout(() => {
            if (winGameId === gameId) nextLevel();
        }, 2200);
    } else if (state.winner === AI) {
        setStatus('lose');
    } else {
        setStatus('draw');
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

// Initial Load
if (LevelRegistry.length > 0) loadLevel(Progress.startLevel());
