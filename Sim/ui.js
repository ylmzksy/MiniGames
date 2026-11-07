const PLAYER = 1;
const AI = 2;
const R = 150;

let currentLevelIdx = 0;
let state = null;
let isAiTurn = false;
let isOver = false;
let gameId = 0;
let statusKey = '';
let lostTriangle = null;

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
    state = SimEngine.create(level);
    isAiTurn = false;
    isOver = false;
    lostTriangle = null;
    updateLevelInfo();
    setStatus('status_your_turn');
    render();
}

function dotPos(i) {
    const a = -Math.PI / 2 + (i * Math.PI * 2) / 6;
    return [200 + Math.cos(a) * R, 190 + Math.sin(a) * R];
}

function render() {
    const edges = SimEngine.pairs.map(([a, b], e) => {
        const [x1, y1] = dotPos(a);
        const [x2, y2] = dotPos(b);
        const c = state.color[e];
        const cls = ['edge', c === 1 ? 'blue' : c === 2 ? 'red' : (isAiTurn || isOver ? 'free' : 'free active'), lostTriangle && lostTriangle.includes(e) ? 'lost' : ''].join(' ');
        return `<g class="${cls}" onclick="handleEdge(${e})"><line class="hit" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"></line><line class="stroke" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"></line></g>`;
    }).join('');
    const dots = Array.from({ length: 6 }, (_, i) => { const [x, y] = dotPos(i); return `<circle class="dot" cx="${x}" cy="${y}" r="9"></circle>`; }).join('');
    boardEl.innerHTML = `<svg viewBox="0 0 400 380" role="img">${edges}${dots}</svg>`;
    const free = SimEngine.freeEdges(state.color).length;
    countersEl.innerText = `${i18n.t('free_edges')}: ${free}`;
}

window.handleEdge = (e) => {
    if (isAiTurn || isOver || state.color[e] !== 0) return;
    state.color[e] = PLAYER;
    const tri = SimEngine.losingTriangle(state.color, e, PLAYER);
    render();
    if (tri) { endGame(AI, tri); return; }
    isAiTurn = true;
    setStatus('status_ai');
    render();
    const moveGameId = gameId;
    setTimeout(() => processAiTurn(moveGameId), 450);
};

function processAiTurn(moveGameId) {
    if (moveGameId !== gameId || isOver) return;
    const difficulty = document.getElementById('difficulty').value;
    const e = difficulty === 'master' ? SimEngine.getMasterMove(state) : SimEngine.getNoviceMove(state);
    state.color[e] = AI;
    const tri = SimEngine.losingTriangle(state.color, e, AI);
    isAiTurn = false;
    render();
    if (tri) { endGame(PLAYER, tri); return; }
    setStatus('status_your_turn');
    render();
}

function endGame(winner, tri) {
    isOver = true;
    isAiTurn = false;
    lostTriangle = tri;
    render();
    if (winner === PLAYER) {
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

function setStatus(key) { statusKey = key; statusEl.innerText = i18n.t(key); }

function updateLevelInfo() {
    const level = LevelRegistry[currentLevelIdx];
    levelInfoEl.innerText = `${i18n.t('level')} ${currentLevelIdx + 1}/${LevelRegistry.length}: ${level.name}`;
}

document.getElementById('restartBtn').onclick = () => loadLevel(currentLevelIdx);
window.addEventListener('langChanged', () => { setStatus(statusKey); updateLevelInfo(); render(); });
if (LevelRegistry.length > 0) loadLevel(Progress.startLevel());
