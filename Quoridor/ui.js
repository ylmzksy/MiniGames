let currentLevelIdx = 0;
let state = null;
let wallMode = false;
let isAiTurn = false;
let isOver = false;
let gameId = 0;
let statusKey = '';
let lastWall = null;

const boardEl = document.getElementById('game-board');
const statusEl = document.getElementById('status');
const levelInfoEl = document.getElementById('level-info');
const countersEl = document.getElementById('counters');
const wallBtn = document.getElementById('wallBtn');

function loadLevel(idx) {
    const level = LevelRegistry[idx];
    if (!level) return;

    currentLevelIdx = idx;
    Progress.setCurrent(idx);
    gameId++;
    state = QuoridorEngine.create(level);
    wallMode = false;
    isAiTurn = false;
    isOver = false;
    lastWall = null;
    updateLevelInfo();
    setStatus('status_your_turn');
    render();
}

function render() {
    const n = state.n;
    const size = 2 * n - 1;
    const track = Array.from({ length: size }, (_, i) => i % 2 === 0 ? '1fr' : '0.28fr').join(' ');
    boardEl.style.gridTemplateColumns = track;
    boardEl.style.gridTemplateRows = track;
    boardEl.style.maxWidth = `${n * 52 + (n - 1) * 14}px`;

    const legal = new Set(!isAiTurn && !isOver && !wallMode ? QuoridorEngine.pawnMoves(state, 'you').map(m => m.join(',')) : []);
    const wallCells = new Set();
    state.placed.forEach(w => {
        if (w.o === 'h') { wallCells.add(`${2 * w.r + 1},${2 * w.c}`); wallCells.add(`${2 * w.r + 1},${2 * w.c + 1}`); wallCells.add(`${2 * w.r + 1},${2 * w.c + 2}`); }
        else { wallCells.add(`${2 * w.r},${2 * w.c + 1}`); wallCells.add(`${2 * w.r + 1},${2 * w.c + 1}`); wallCells.add(`${2 * w.r + 2},${2 * w.c + 1}`); }
    });
    const out = [];
    for (let gr = 0; gr < size; gr++) {
        for (let gc = 0; gc < size; gc++) {
            const key = `${gr},${gc}`;
            const wall = wallCells.has(key) ? 'wall' : '';
            if (gr % 2 === 0 && gc % 2 === 0) {
                const r = gr / 2;
                const c = gc / 2;
                const you = state.pawns.you[0] === r && state.pawns.you[1] === c;
                const ai = state.pawns.ai[0] === r && state.pawns.ai[1] === c;
                const classes = ['cell', r === 0 ? 'goal-you' : '', r === n - 1 ? 'goal-ai' : '', legal.has(`${r},${c}`) ? 'legal' : ''].join(' ');
                out.push(`<div class="${classes}" onclick="handleCell(${r}, ${c})">${you ? '<span class="pawn you"></span>' : ai ? '<span class="pawn ai"></span>' : ''}</div>`);
            } else if (gr % 2 === 1 && gc % 2 === 0) {
                out.push(`<div class="groove h ${wall} ${wallMode ? 'active' : ''}" data-key="${key}" onclick="handleGroove(${(gr - 1) / 2}, ${gc / 2}, 'h')"></div>`);
            } else if (gr % 2 === 0) {
                out.push(`<div class="groove v ${wall} ${wallMode ? 'active' : ''}" data-key="${key}" onclick="handleGroove(${gr / 2}, ${(gc - 1) / 2}, 'v')"></div>`);
            } else {
                out.push(`<div class="joint ${wall}"></div>`);
            }
        }
    }
    boardEl.innerHTML = out.join('');
    countersEl.innerText = `${i18n.t('walls_you')}: ${state.walls.you} · ${i18n.t('walls_ai')}: ${state.walls.ai}`;
    wallBtn.classList.toggle('primary', wallMode);
    wallBtn.disabled = isAiTurn || isOver || state.walls.you <= 0;
}

window.toggleWallMode = () => {
    if (isAiTurn || isOver || state.walls.you <= 0) return;
    wallMode = !wallMode;
    setStatus(wallMode ? 'status_wall_mode' : 'status_your_turn');
    render();
};

window.handleCell = (r, c) => {
    if (isAiTurn || isOver || wallMode) return;
    const legal = QuoridorEngine.pawnMoves(state, 'you').some(m => m[0] === r && m[1] === c);
    if (!legal) return;
    playMove({ type: 'move', to: [r, c] });
};

// A tap on a groove segment places the wall that starts there, or the one ending there
window.handleGroove = (r, c, o) => {
    if (isAiTurn || isOver || !wallMode) return;
    const options = o === 'h' ? [{ r, c, o }, { r, c: c - 1, o }] : [{ r, c, o }, { r: r - 1, c, o }];
    const w = options.find(x => QuoridorEngine.canPlaceWall(state, 'you', x));
    if (!w) { setStatus('status_wall_invalid'); flashInvalid(r, c, o); return; }
    wallMode = false;
    playMove({ type: 'wall', ...w });
};

function flashInvalid(r, c, o) {
    const key = o === 'h' ? `${2 * r + 1},${2 * c}` : `${2 * r},${2 * c + 1}`;
    const el = boardEl.querySelector(`.groove[data-key="${key}"]`);
    if (el) { el.classList.add('invalid'); setTimeout(() => el.classList.remove('invalid'), 500); }
}

function playMove(move) {
    state = QuoridorEngine.apply(state, move);
    lastWall = move.type === 'wall' ? move : null;
    render();
    if (checkEnd()) return;
    isAiTurn = true;
    setStatus('status_ai');
    render();
    const moveGameId = gameId;
    setTimeout(() => processAiTurn(moveGameId), 400);
}

function processAiTurn(moveGameId) {
    if (moveGameId !== gameId || isOver) return;
    const difficulty = document.getElementById('difficulty').value;
    const level = LevelRegistry[currentLevelIdx];
    const move = difficulty === 'master' ? QuoridorEngine.getMasterMove(state, level.depth) : QuoridorEngine.getNoviceMove(state);
    state = QuoridorEngine.apply(state, move);
    isAiTurn = false;
    render();
    if (checkEnd()) return;
    setStatus('status_your_turn');
}

function checkEnd() {
    if (!state.winner) return false;
    isOver = true;
    isAiTurn = false;
    render();
    if (state.winner === 'you') {
        setStatus('win');
        Progress.markSolved(currentLevelIdx);
        const winGameId = gameId;
        setTimeout(() => { if (winGameId === gameId) nextLevel(); }, 2200);
    } else {
        setStatus('lose');
    }
    return true;
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

document.addEventListener('keydown', (event) => {
    if (document.querySelector('.modal.active')) return;
    if (event.key.toLowerCase() === 'w') { toggleWallMode(); event.preventDefault(); }
});

document.getElementById('restartBtn').onclick = () => loadLevel(currentLevelIdx);

window.addEventListener('langChanged', () => {
    setStatus(statusKey);
    updateLevelInfo();
    render();
});

if (LevelRegistry.length > 0) loadLevel(Progress.startLevel());
