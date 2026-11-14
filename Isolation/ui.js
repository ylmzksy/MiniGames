let currentLevelIdx = 0;
let state = null;
let phase = 'step';     // 'step' then 'remove'
let isAiTurn = false;
let isOver = false;
let gameId = 0;
let statusKey = '';
let lastRemoved = null;

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
    state = IsolationEngine.create(level);
    phase = 'step';
    isAiTurn = false;
    isOver = false;
    lastRemoved = null;
    updateLevelInfo();
    setStatus('status_step');
    render();
}

function render() {
    const n = state.n;
    boardEl.style.gridTemplateColumns = `repeat(${n}, 1fr)`;
    boardEl.style.maxWidth = `${n * 56}px`;
    const legalSteps = new Set(!isAiTurn && !isOver && phase === 'step' ? IsolationEngine.steps(state, 'you').map(s => s.join(',')) : []);
    const removable = !isAiTurn && !isOver && phase === 'remove';
    const cells = [];
    for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
            const key = `${r},${c}`;
            const hole = state.holes.has(key);
            const you = state.pieces.you[0] === r && state.pieces.you[1] === c;
            const ai = state.pieces.ai[0] === r && state.pieces.ai[1] === c;
            const free = !hole && !you && !ai;
            const classes = ['cell', hole ? 'hole' : '', legalSteps.has(key) ? 'legal' : '', removable && free ? 'removable' : '',
                lastRemoved === key ? 'just-removed' : ''].join(' ');
            cells.push(`<div class="${classes}" onclick="handleCell(${r}, ${c})">${you ? '<span class="piece you"></span>' : ai ? '<span class="piece ai"></span>' : ''}</div>`);
        }
    }
    boardEl.innerHTML = cells.join('');
    countersEl.innerText = `${i18n.t('your_moves')}: ${IsolationEngine.steps(state, 'you').length} · ${i18n.t('ai_moves')}: ${IsolationEngine.steps(state, 'ai').length}`;
}

let pendingStep = null;  // the square stepped to, while the removal is chosen
let stepOrigin = null;   // where the piece came from, so the full turn can be applied at once

window.handleCell = (r, c) => {
    if (isAiTurn || isOver) return;
    if (phase === 'step') {
        if (!IsolationEngine.steps(state, 'you').some(s => s[0] === r && s[1] === c)) return;
        stepOrigin = [...state.pieces.you];
        pendingStep = [r, c];
        state.pieces.you = [r, c]; // shown on its new square while the removal is picked
        phase = 'remove';
        setStatus('status_remove');
        render();
        return;
    }
    if (!IsolationEngine.free(state, r, c)) return;
    state.pieces.you = stepOrigin;
    state = IsolationEngine.apply(state, { to: pendingStep, remove: [r, c] });
    lastRemoved = `${r},${c}`;
    phase = 'step';
    pendingStep = null;
    render();
    if (checkEnd()) return;
    isAiTurn = true;
    setStatus('status_ai');
    const moveGameId = gameId;
    setTimeout(() => processAiTurn(moveGameId), 400);
};

function processAiTurn(moveGameId) {
    if (moveGameId !== gameId || isOver) return;
    const difficulty = document.getElementById('difficulty').value;
    const level = LevelRegistry[currentLevelIdx];
    const move = difficulty === 'master' ? IsolationEngine.getMasterMove(state, level.depth) : IsolationEngine.getNoviceMove(state);
    if (!move) { endGame('you'); return; }
    state = IsolationEngine.apply(state, move);
    lastRemoved = `${move.remove[0]},${move.remove[1]}`;
    isAiTurn = false;
    render();
    if (checkEnd()) return;
    setStatus('status_step');
}

// The side to move with no step loses
function checkEnd() {
    const mover = state.turn;
    if (IsolationEngine.steps(state, mover).length > 0) return false;
    endGame(mover === 'ai' ? 'you' : 'ai');
    return true;
}

function endGame(winner) {
    isOver = true;
    isAiTurn = false;
    render();
    if (winner === 'you') {
        setStatus('win');
        Progress.markSolved(currentLevelIdx);
        const winGameId = gameId;
        setTimeout(() => { if (winGameId === gameId) nextLevel(); }, 2200);
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
    levelInfoEl.innerText = `${i18n.t('level')} ${currentLevelIdx + 1}/${LevelRegistry.length}: ${level.name} (${level.size}×${level.size})`;
}

document.getElementById('restartBtn').onclick = () => loadLevel(currentLevelIdx);

window.addEventListener('langChanged', () => {
    setStatus(statusKey);
    updateLevelInfo();
    render();
});

if (LevelRegistry.length > 0) loadLevel(Progress.startLevel());
