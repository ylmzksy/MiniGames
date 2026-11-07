const PLAYER = 0;
const AI = 1;

let currentLevelIdx = 0;
let state = null;
let selected = null;   // [r, c] of the piece being moved
let partial = null;    // { path, captures, display } while a multi-jump is chosen step by step
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
    state = CheckersEngine.create(level);
    selected = null;
    partial = null;
    isAiTurn = false;
    isOver = false;
    moves = 0;
    lastMove = null;
    updateLevelInfo();
    setStatus('status_your_turn');
    render();
}

// Moves that continue the current partial path (or all moves when nothing is selected)
function candidates() {
    const all = CheckersEngine.moves(state, PLAYER);
    if (!selected) return all;
    const prefix = partial ? partial.path : [selected];
    return all.filter(m => m.from[0] === selected[0] && m.from[1] === selected[1]
        && prefix.every((cell, i) => m.path[i] && m.path[i][0] === cell[0] && m.path[i][1] === cell[1]));
}

function render() {
    const n = state.n;
    boardEl.style.gridTemplateColumns = `repeat(${n}, 1fr)`;
    boardEl.style.maxWidth = `${n * 56}px`;
    const display = partial ? partial.display : state.board;
    const targets = new Set();
    if (!isAiTurn && !isOver) {
        const step = partial ? partial.path.length : 1;
        candidates().forEach(m => { if (selected && m.path[step]) targets.add(m.path[step].join(',')); });
    }
    const movable = new Set(!isAiTurn && !isOver && !partial ? CheckersEngine.moves(state, PLAYER).map(m => m.from.join(',')) : []);
    const cells = [];
    for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
            const key = `${r},${c}`;
            const p = display[r][c];
            const classes = ['cell', (r + c) % 2 ? 'dark' : 'light',
                selected && selected[0] === r && selected[1] === c ? 'selected' : '',
                targets.has(key) ? 'target' : '', movable.has(key) ? 'movable' : '',
                lastMove && lastMove.path.some(([pr, pc]) => pr === r && pc === c) ? 'last' : ''].join(' ');
            const piece = p ? `<span class="piece ${p.owner === PLAYER ? 'you' : 'ai'} ${p.king ? 'king' : ''}">${p.king ? '♛' : ''}</span>` : '';
            cells.push(`<div class="${classes}" onclick="handleCell(${r}, ${c})">${piece}</div>`);
        }
    }
    boardEl.innerHTML = cells.join('');
    const count = side => state.board.flat().filter(p => p && p.owner === side).length;
    countersEl.innerText = `${i18n.t('you')}: ${count(PLAYER)} · ${i18n.t('ai')}: ${count(AI)} · ${i18n.t('moves')}: ${moves}`;
}

window.handleCell = (r, c) => {
    if (isAiTurn || isOver) return;
    const piece = state.board[r][c];
    if (!partial && piece && piece.owner === PLAYER) {
        selected = selected && selected[0] === r && selected[1] === c ? null : [r, c];
        setStatus(selected ? (candidates().length ? 'status_pick_target' : 'status_no_moves_piece') : 'status_your_turn');
        render();
        return;
    }
    if (!selected) return;
    const step = partial ? partial.path.length : 1;
    const options = candidates().filter(m => m.path[step] && m.path[step][0] === r && m.path[step][1] === c);
    if (!options.length) return;
    const done = options.find(m => m.path.length === step + 1);
    if (done) { playMove(done); return; }
    // more jumps follow: show the piece at its new square and keep choosing
    const sample = options[0];
    const display = (partial ? partial.display : state.board).map(row => row.map(p => p && { ...p }));
    const [pr, pc] = sample.path[step - 1];
    display[r][c] = display[pr][pc];
    display[pr][pc] = null;
    const [cr, cc] = sample.captures[step - 1];
    display[cr][cc] = null;
    partial = { path: sample.path.slice(0, step + 1), display };
    setStatus('status_keep_jumping');
    render();
};

function playMove(move) {
    state = CheckersEngine.apply(state, move);
    lastMove = move;
    selected = null;
    partial = null;
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
    const move = difficulty === 'master' ? CheckersEngine.getMasterMove(state, depth) : CheckersEngine.getNoviceMove(state);
    isAiTurn = false;
    if (!move) { checkEnd(); return; }
    state = CheckersEngine.apply(state, move);
    lastMove = move;
    moves++;
    render();
    if (checkEnd()) return;
    setStatus('status_your_turn');
}

function checkEnd() {
    const res = CheckersEngine.result(state);
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
    } else if (res.winner === AI) {
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
    levelInfoEl.innerText = `${i18n.t('level')} ${currentLevelIdx + 1}/${LevelRegistry.length}: ${level.name} (${level.size}×${level.size})`;
}

document.getElementById('restartBtn').onclick = () => loadLevel(currentLevelIdx);

window.addEventListener('langChanged', () => {
    setStatus(statusKey);
    updateLevelInfo();
    render();
});

// Initial Load
if (LevelRegistry.length > 0) loadLevel(Progress.startLevel());
