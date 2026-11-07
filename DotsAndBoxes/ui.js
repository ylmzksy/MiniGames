const PLAYER = 0;
const AI = 1;

let currentLevelIdx = 0;
let state = null;
let isAiTurn = false;
let isOver = false;
let gameId = 0;
let statusKey = '';
let lastEdge = null;

const board = document.getElementById('game-board');
const statusEl = document.getElementById('status');
const levelInfoEl = document.getElementById('level-info');
const countersEl = document.getElementById('counters');

function loadLevel(idx) {
    const level = LevelRegistry[idx];
    if (!level) return;
    currentLevelIdx = idx;
    Progress.setCurrent(idx);
    gameId++;
    state = DotsEngine.create(level);
    isAiTurn = false;
    isOver = false;
    lastEdge = null;
    updateLevelInfo();
    setStatus('status_your_turn');
    render();
}

function render() {
    const { rows, cols } = state;
    const track = n => Array.from({ length: 2 * n + 1 }, (_, i) => i % 2 === 0 ? '14px' : '1fr').join(' ');
    board.style.gridTemplateColumns = track(cols);
    board.style.gridTemplateRows = track(rows);
    board.style.maxWidth = `${cols * 64 + 14 * (cols + 1)}px`;
    const out = [];
    for (let gr = 0; gr <= 2 * rows; gr++) {
        for (let gc = 0; gc <= 2 * cols; gc++) {
            if (gr % 2 === 0 && gc % 2 === 0) out.push('<div class="dot"></div>');
            else if (gr % 2 === 0) out.push(renderEdge({ t: 'h', r: gr / 2, c: (gc - 1) / 2 }, 'h'));
            else if (gc % 2 === 0) out.push(renderEdge({ t: 'v', r: (gr - 1) / 2, c: gc / 2 }, 'v'));
            else {
                const owner = state.owner[(gr - 1) / 2][(gc - 1) / 2];
                out.push(`<div class="box ${owner === null ? '' : owner === PLAYER ? 'blue' : 'red'}">${owner === null ? '' : i18n.t(owner === PLAYER ? 'box_you' : 'box_ai')}</div>`);
            }
        }
    }
    board.innerHTML = out.join('');
    countersEl.innerText = `${i18n.t('you')}: ${state.scores[PLAYER]} · ${i18n.t('ai')}: ${state.scores[AI]}`;
}

function renderEdge(e, orientation) {
    const drawn = DotsEngine.isDrawn(state, e);
    const last = lastEdge && lastEdge.t === e.t && lastEdge.r === e.r && lastEdge.c === e.c;
    const classes = ['edge', orientation, drawn ? 'drawn' : (isAiTurn || isOver ? '' : 'free'), last ? 'last' : ''].join(' ');
    return `<div class="${classes}" onclick="handleEdge('${e.t}', ${e.r}, ${e.c})"></div>`;
}

window.handleEdge = (t, r, c) => {
    if (isAiTurn || isOver) return;
    const e = { t, r, c };
    if (DotsEngine.isDrawn(state, e)) return;
    const claimed = DotsEngine.apply(state, e);
    lastEdge = e;
    render();
    if (checkEnd()) return;
    if (claimed) { setStatus('status_again'); return; }
    isAiTurn = true;
    setStatus('status_ai');
    render();
    const moveGameId = gameId;
    setTimeout(() => processAiTurn(moveGameId), 450);
};

function processAiTurn(moveGameId) {
    if (moveGameId !== gameId || isOver) return;
    const difficulty = document.getElementById('difficulty').value;
    const e = difficulty === 'master' ? DotsEngine.getMasterMove(state) : DotsEngine.getNoviceMove(state);
    const claimed = DotsEngine.apply(state, e);
    lastEdge = e;
    render();
    if (checkEnd()) return;
    if (claimed) { setTimeout(() => processAiTurn(moveGameId), 450); return; }
    isAiTurn = false;
    setStatus('status_your_turn');
    render();
}

function checkEnd() {
    if (!DotsEngine.isOver(state)) return false;
    isOver = true;
    isAiTurn = false;
    render();
    const [you, ai] = state.scores;
    if (you > ai) {
        setStatus('win');
        Progress.markSolved(currentLevelIdx);
        const winGameId = gameId;
        setTimeout(() => { if (winGameId === gameId) nextLevel(); }, 2200);
    } else {
        setStatus(you === ai ? 'draw' : 'lose');
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
    levelInfoEl.innerText = `${i18n.t('level')} ${currentLevelIdx + 1}/${LevelRegistry.length}: ${level.name} (${level.cols}×${level.rows})`;
}

document.getElementById('restartBtn').onclick = () => loadLevel(currentLevelIdx);
window.addEventListener('langChanged', () => { setStatus(statusKey); updateLevelInfo(); render(); });
if (LevelRegistry.length > 0) loadLevel(Progress.startLevel());
