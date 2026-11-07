const PLAYER = 0;
const AI = 1;
const UNIT = 60;

let currentLevelIdx = 0;
let state = null;
let selected = null;   // own man chosen to move
let pending = null;    // move awaiting a removal choice: { type, from, to }
let isAiTurn = false;
let isOver = false;
let gameId = 0;
let statusKey = '';
let moves = 0;
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
    state = MorrisEngine.create(level);
    selected = null;
    pending = null;
    isAiTurn = false;
    isOver = false;
    moves = 0;
    lastMove = null;
    updateLevelInfo();
    setStatus('status_place');
    render();
}

function pos(i) {
    const [x, y] = MorrisEngine.points[i];
    return [x * UNIT + UNIT / 2, y * UNIT + UNIT / 2];
}

function render() {
    const E = MorrisEngine;
    const board = pending ? applyPendingToBoard() : state.board;
    const legal = new Set();
    const removable = new Set();
    if (!isAiTurn && !isOver) {
        if (pending) {
            E.removable(board, PLAYER).forEach(i => removable.add(i));
        } else if (state.inHand[PLAYER] > 0) {
            E.moves(state, PLAYER).forEach(m => legal.add(m.to));
        } else if (selected !== null) {
            E.moves(state, PLAYER).filter(m => m.from === selected).forEach(m => legal.add(m.to));
        }
    }
    const lines = E.mills.map(([a, , c]) => { const [x1, y1] = pos(a); const [x2, y2] = pos(c); return `<line class="line" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"></line>`; }).join('');
    const points = E.points.map((_, i) => {
        const [x, y] = pos(i);
        const owner = board[i];
        const classes = ['point', owner === PLAYER ? 'you' : owner === AI ? 'ai' : 'empty',
            legal.has(i) ? 'legal' : '', removable.has(i) ? 'removable' : '',
            selected === i ? 'selected' : '', lastMove && (lastMove.to === i || lastMove.from === i) ? 'last' : ''].join(' ');
        return `<g class="${classes}" onclick="handlePoint(${i})"><circle class="hit" cx="${x}" cy="${y}" r="22"></circle><circle class="dot" cx="${x}" cy="${y}" r="${owner === null ? 6 : 16}"></circle></g>`;
    }).join('');
    boardEl.innerHTML = `<svg viewBox="0 0 ${7 * UNIT} ${7 * UNIT}" role="img">${lines}${points}</svg>`;
    countersEl.innerText = `${i18n.t('you')}: ${E.count(state, PLAYER)} + ${state.inHand[PLAYER]} · ${i18n.t('ai')}: ${E.count(state, AI)} + ${state.inHand[AI]} · ${i18n.t('moves')}: ${moves}`;
}

function applyPendingToBoard() {
    const board = [...state.board];
    if (pending.type === 'move') board[pending.from] = null;
    board[pending.to] = PLAYER;
    return board;
}

window.handlePoint = (i) => {
    if (isAiTurn || isOver) return;
    const E = MorrisEngine;
    if (pending) {
        if (!E.removable(applyPendingToBoard(), PLAYER).includes(i)) return;
        const move = { ...pending, remove: i };
        pending = null;
        playMove(move);
        return;
    }
    if (state.inHand[PLAYER] > 0) {
        if (state.board[i] !== null) return;
        commit({ type: 'place', to: i });
        return;
    }
    if (state.board[i] === PLAYER) {
        selected = selected === i ? null : i;
        setStatus(selected === null ? 'status_move' : 'status_pick_target');
        render();
        return;
    }
    if (selected === null) return;
    const options = E.moves(state, PLAYER).filter(m => m.from === selected && m.to === i);
    if (!options.length) return;
    commit({ type: 'move', from: selected, to: i });
};

// Commits a placement or slide; if it forms a mill, ask which enemy man to remove
function commit(base) {
    const E = MorrisEngine;
    const board = [...state.board];
    if (base.type === 'move') board[base.from] = null;
    board[base.to] = PLAYER;
    selected = null;
    if (E.inMill(board, base.to, PLAYER) && E.removable(board, PLAYER).length) {
        pending = base;
        setStatus('status_remove');
        render();
        return;
    }
    playMove(base);
}

function playMove(move) {
    state = MorrisEngine.apply(state, move);
    lastMove = move;
    moves++;
    render();
    if (checkEnd()) return;

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
    const move = difficulty === 'master' ? MorrisEngine.getMasterMove(state, depth) : MorrisEngine.getNoviceMove(state);
    isAiTurn = false;
    if (!move) { checkEnd(); return; }
    state = MorrisEngine.apply(state, move);
    lastMove = move;
    moves++;
    render();
    if (checkEnd()) return;
    setStatus(promptKey());
}

function promptKey() {
    const phase = MorrisEngine.phase(state, PLAYER);
    return phase === 'placing' ? 'status_place' : phase === 'flying' ? 'status_fly' : 'status_move';
}

function checkEnd() {
    const res = MorrisEngine.result(state);
    if (!res) return false;
    isOver = true;
    isAiTurn = false;
    render();
    if (res.winner === PLAYER) {
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
