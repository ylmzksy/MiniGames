const PLAYER = 1;
const AI = 2;

let currentLevelIdx = 0;
let state = null;
let phase = 'pick';      // pick → move → shoot
let selected = null;     // amazon being moved
let pending = null;      // state after the move, before the arrow
let moveTo = null;
let isAiTurn = false;
let isOver = false;
let gameId = 0;
let statusKey = '';
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
    state = AmazonsEngine.create(level);
    phase = 'pick';
    selected = null;
    pending = null;
    moveTo = null;
    isAiTurn = false;
    isOver = false;
    lastMove = null;
    updateLevelInfo();
    setStatus('status_pick');
    render();
}

function render() {
    const n = state.size;
    boardEl.style.gridTemplateColumns = `repeat(${n}, 1fr)`;
    boardEl.style.maxWidth = `${n * 48}px`;
    const shown = phase === 'shoot' ? pending : state;
    const targets = new Set();
    if (phase === 'move' && selected) AmazonsEngine.reach(state, ...selected).forEach(([r, c]) => targets.add(`${r},${c}`));
    if (phase === 'shoot' && moveTo) AmazonsEngine.reach(pending, ...moveTo).forEach(([r, c]) => targets.add(`${r},${c}`));

    const cells = [];
    for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
            const v = shown.cells[r][c];
            const key = `${r},${c}`;
            const classes = ['cell', (r + c) % 2 ? 'dark' : 'light',
                v === 1 ? 'amazon mine' : v === 2 ? 'amazon theirs' : v === 3 ? 'arrow' : '',
                selected && selected[0] === r && selected[1] === c && phase === 'move' ? 'selected' : '',
                moveTo && moveTo[0] === r && moveTo[1] === c && phase === 'shoot' ? 'selected' : '',
                targets.has(key) ? 'target' : '',
                lastMove && ((lastMove.to[0] === r && lastMove.to[1] === c) || (lastMove.arrow[0] === r && lastMove.arrow[1] === c)) ? 'last' : '',
                v === 1 && !isAiTurn && !isOver && phase !== 'shoot' ? 'pickable' : ''].join(' ');
            const content = v === 1 || v === 2 ? '♛' : v === 3 ? '✕' : '';
            cells.push(`<div class="${classes}" onclick="handleCell(${r}, ${c})">${content}</div>`);
        }
    }
    boardEl.innerHTML = cells.join('');
    countersEl.innerText = `${i18n.t('mobility')}: ${AmazonsEngine.mobility(state, PLAYER)} / ${AmazonsEngine.mobility(state, AI)}`;
}

window.handleCell = (r, c) => {
    if (isAiTurn || isOver) return;
    if (phase === 'pick' || phase === 'move') {
        if (state.cells[r][c] === PLAYER) {
            selected = [r, c];
            phase = 'move';
            setStatus('status_move');
            render();
            return;
        }
        if (phase === 'move' && AmazonsEngine.reach(state, ...selected).some(([tr, tc]) => tr === r && tc === c)) {
            pending = AmazonsEngine.clone(state);
            pending.cells[selected[0]][selected[1]] = 0;
            pending.cells[r][c] = PLAYER;
            moveTo = [r, c];
            phase = 'shoot';
            setStatus('status_shoot');
            render();
        }
        return;
    }
    if (phase === 'shoot') {
        if (r === moveTo[0] && c === moveTo[1]) { // tapping the amazon again cancels the move
            phase = 'move';
            pending = null;
            moveTo = null;
            setStatus('status_move');
            render();
            return;
        }
        if (!AmazonsEngine.reach(pending, ...moveTo).some(([ar, ac]) => ar === r && ac === c)) return;
        const move = { from: selected, to: moveTo, arrow: [r, c] };
        state = AmazonsEngine.apply(state, move);
        lastMove = move;
        phase = 'pick';
        selected = null;
        pending = null;
        moveTo = null;
        render();
        if (checkEnd(AI)) return;
        isAiTurn = true;
        setStatus('status_ai');
        render();
        const moveGameId = gameId;
        setTimeout(() => processAiTurn(moveGameId), 60);
    }
};

function processAiTurn(moveGameId) {
    if (moveGameId !== gameId || isOver) return;
    const master = document.getElementById('difficulty').value === 'master';
    const move = master ? AmazonsEngine.getMasterMove(state, LevelRegistry[currentLevelIdx].budget || 1200) : AmazonsEngine.getNoviceMove(state);
    if (!move) { endGame(PLAYER); return; }
    state = AmazonsEngine.apply(state, move);
    lastMove = move;
    isAiTurn = false;
    render();
    if (checkEnd(PLAYER)) return;
    setStatus('status_pick');
}

// The side to move next loses when it has no move
function checkEnd(nextSide) {
    if (AmazonsEngine.hasMove(state, nextSide)) return false;
    endGame(nextSide === AI ? PLAYER : AI);
    return true;
}

function endGame(winner) {
    isOver = true;
    isAiTurn = false;
    render();
    if (winner === PLAYER) {
        setStatus('win');
        Progress.markSolved(currentLevelIdx);
        const winGameId = gameId;
        setTimeout(() => {
            if (winGameId === gameId) nextLevel();
        }, 2400);
    } else {
        setStatus('lose');
    }
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
