const PLAYER = GoEngine.BLACK;
const AI = GoEngine.WHITE;
const UNIT = 40; // SVG units between lines

let currentLevelIdx = 0;
let state = null;
let isAiTurn = false;
let isOver = false;
let gameId = 0;
let statusKey = '';
let statusParams = {};

const boardEl = document.getElementById('game-board');
const statusEl = document.getElementById('status');
const levelInfoEl = document.getElementById('level-info');
const countersEl = document.getElementById('counters');
const passBtn = document.getElementById('passBtn');

function loadLevel(idx) {
    const level = LevelRegistry[idx];
    if (!level) return;

    currentLevelIdx = idx;
    Progress.setCurrent(idx);
    gameId++;
    state = GoEngine.create(level);
    isAiTurn = false;
    isOver = false;
    updateLevelInfo();
    setStatus('status_your_turn');
    render();
}

function render() {
    const n = state.size;
    const size = (n + 1) * UNIT;
    const lines = [];
    for (let i = 0; i < n; i++) {
        const p = (i + 1) * UNIT;
        lines.push(`<line class="grid" x1="${UNIT}" y1="${p}" x2="${n * UNIT}" y2="${p}"></line><line class="grid" x1="${p}" y1="${UNIT}" x2="${p}" y2="${n * UNIT}"></line>`);
    }
    const stars = n === 9 ? [[2, 2], [2, 6], [6, 2], [6, 6], [4, 4]] : n === 7 ? [[2, 2], [2, 4], [4, 2], [4, 4], [3, 3]] : [];
    const starHtml = stars.map(([r, c]) => `<circle class="star" cx="${(c + 1) * UNIT}" cy="${(r + 1) * UNIT}" r="3"></circle>`).join('');
    const stones = [];
    for (let i = 0; i < n * n; i++) {
        const r = Math.floor(i / n);
        const c = i % n;
        const x = (c + 1) * UNIT;
        const y = (r + 1) * UNIT;
        const v = state.cells[i];
        if (v) stones.push(`<circle class="stone ${v === 1 ? 'black' : 'white'} ${i === state.last ? 'last' : ''}" cx="${x}" cy="${y}" r="${UNIT * 0.46}"></circle>`);
        else stones.push(`<circle class="spot ${!isAiTurn && !isOver ? 'free' : ''}" cx="${x}" cy="${y}" r="${UNIT * 0.46}" onclick="handlePlay(${i})"></circle>`);
    }
    boardEl.innerHTML = `<svg viewBox="0 0 ${size} ${size}" role="img"><rect class="wood" x="0" y="0" width="${size}" height="${size}"></rect>${lines.join('')}${starHtml}${stones.join('')}</svg>`;
    passBtn.disabled = isAiTurn || isOver;
    const score = GoEngine.score(state);
    countersEl.innerText = `${i18n.t('captures')}: ${state.captures[PLAYER]} / ${state.captures[AI]} · ${i18n.t('area')}: ${score.black} / ${score.white}`;
}

window.handlePlay = (i) => {
    if (isAiTurn || isOver) return;
    const next = GoEngine.play(state, i);
    if (!next) { setStatus('status_illegal'); return; }
    state = next;
    afterPlayerMove();
};

window.handlePass = () => {
    if (isAiTurn || isOver) return;
    state = GoEngine.pass(state);
    afterPlayerMove();
};

function afterPlayerMove() {
    render();
    if (checkEnd()) return;
    isAiTurn = true;
    setStatus('status_ai');
    render();
    const moveGameId = gameId;
    setTimeout(() => processAiTurn(moveGameId), 60);
}

function processAiTurn(moveGameId) {
    if (moveGameId !== gameId || isOver) return;
    const level = LevelRegistry[currentLevelIdx];
    const master = document.getElementById('difficulty').value === 'master';
    const move = GoEngine.getMove(state, master ? level.budget : Math.max(60, level.budget / 6), master ? 0 : 0.3);
    state = move < 0 ? GoEngine.pass(state) : GoEngine.play(state, move);
    isAiTurn = false;
    render();
    if (checkEnd()) return;
    setStatus(move < 0 ? 'status_ai_passed' : 'status_your_turn');
}

function checkEnd() {
    if (!state.over) return false;
    isOver = true;
    isAiTurn = false;
    render();
    const score = GoEngine.score(state);
    const params = { black: score.black, white: score.white };
    if (score.black > score.white) {
        setStatus('win', params);
        Progress.markSolved(currentLevelIdx);
        const winGameId = gameId;
        setTimeout(() => {
            if (winGameId === gameId) nextLevel();
        }, 3000);
    } else {
        setStatus('lose', params);
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
    levelInfoEl.innerText = `${i18n.t('level')} ${currentLevelIdx + 1}/${LevelRegistry.length}: ${level.name} (${level.size}×${level.size}, ${i18n.t('komi')} ${level.komi})`;
}

document.getElementById('restartBtn').onclick = () => loadLevel(currentLevelIdx);
passBtn.onclick = () => handlePass();

window.addEventListener('langChanged', () => {
    setStatus(statusKey, statusParams);
    updateLevelInfo();
    render();
});

// Initial Load
if (LevelRegistry.length > 0) loadLevel(Progress.startLevel());
