/**
 * Pattern Swap page: swap neighbouring tiles until the board shows the target
 * pattern. Tap a tile and then a neighbour, or drag a tile onto a neighbour.
 * Each cell's socket is tinted with the colour the target wants there.
 * Tiles keep their DOM elements for the whole level and move with transforms.
 * Keyboard: arrows move the cursor; Enter / Space pick the tile, then an
 * arrow swaps it with that neighbour. Escape drops the pick, Z undoes.
 */
const SWAP_MS = 220;
const DRAG_MIN = 0.35; // of a cell
const SHAPES = { blue: 'circle', orange: 'triangle', green: 'square', red: 'diamond' };
const DIRS = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };

let currentLevelIdx = 0;
let state = null;
let history = [];
let solved = false;
let selected = null; // cell index of the picked tile
let cursor = 0;
let showCursor = false;
let statusKey = 'status_play';
let cell = 64;
let tileEls = [];   // tile id -> element
let socketEls = []; // cell index -> socket element
let cursorEl = null;
let drag = null;
let suppressClick = false;

const board = document.getElementById('board');
const preview = document.getElementById('target-preview');
const statusEl = document.getElementById('status');
const levelInfoEl = document.getElementById('level-info');
const countersEl = document.getElementById('counters');
const undoBtn = document.getElementById('undoBtn');

function loadLevel(idx) {
    const level = LevelRegistry[idx];
    if (!level) return;
    currentLevelIdx = idx;
    Progress.setCurrent(idx);
    state = PatternEngine.parse(level);
    history = [];
    solved = false;
    selected = null;
    cursor = 0;
    drag = null;
    suppressClick = false;
    setStatus('status_play');
    updateLevelInfo();
    buildPreview();
    buildBoard();
    render();
}

const colorName = letter => state.colors[letter];

/* ---------- Building (once per level) ---------- */

function cellSize() {
    const room = Math.min(440, document.getElementById('app').clientWidth - 32) - 20;
    return Math.max(40, Math.min(84, Math.floor(room / state.cols)));
}

function buildBoard() {
    board.innerHTML = '';
    board.classList.remove('solved');
    socketEls = [];
    for (let i = 0; i < state.n; i++) {
        const socket = document.createElement('div');
        socket.className = `socket c-${colorName(state.goal[i])}`;
        board.appendChild(socket);
        socketEls.push(socket);
    }
    tileEls = state.tiles.map(tile => {
        const el = document.createElement('div');
        const name = colorName(tile.c);
        el.className = `tile c-${name}`;
        el.dataset.id = tile.id;
        el.innerHTML = `<div class="glaze"><span class="sym ${SHAPES[name]}"></span></div>`;
        board.appendChild(el);
        return el;
    });
    cursorEl = document.createElement('div');
    cursorEl.className = 'cursor';
    board.appendChild(cursorEl);
    layout();
}

// Sizes the board and puts sockets and tiles at their cells (also used on resize)
function layout() {
    cell = cellSize();
    board.style.setProperty('--cell', `${cell}px`);
    board.style.width = `${state.cols * cell + 20}px`;
    board.style.height = `${state.rows * cell + 20}px`;
    board.classList.add('instant');
    socketEls.forEach((el, i) => place(el, i));
    state.cells.forEach((id, i) => place(tileEls[id], i));
    placeCursor();
    void board.offsetWidth;
    board.classList.remove('instant');
}

function place(el, i) {
    const [x, y] = PatternEngine.xy(state, i);
    el.style.transform = `translate(${x * cell}px, ${y * cell}px)`;
}

function placeCursor() {
    place(cursorEl, cursor);
    cursorEl.hidden = !showCursor || solved;
}

function buildPreview() {
    const size = Math.max(14, Math.min(26, Math.floor(Math.min(130 / state.cols, 110 / state.rows))));
    preview.style.setProperty('--mini', `${size}px`);
    const cells = [...state.goal].map(letter => {
        const name = colorName(letter);
        return `<i class="c-${name}"><span class="sym ${SHAPES[name]}"></span></i>`;
    });
    preview.innerHTML = `<div class="mini" style="grid-template-columns: repeat(${state.cols}, var(--mini))">${cells.join('')}</div>`;
}

/* ---------- Rendering (class toggles only) ---------- */

function render() {
    state.cells.forEach((id, i) => {
        const el = tileEls[id];
        el.classList.toggle('right', PatternEngine.isRight(state, i));
        el.classList.toggle('selected', selected === i);
        el.classList.toggle('reach', selected !== null && PatternEngine.canSwap(state, selected, i));
    });
    board.classList.toggle('solved', solved);
    placeCursor();
    countersEl.innerHTML = [
        `${i18n.t('swaps')}: <b>${state.moves}</b>`,
        `${i18n.t('par')}: <b>${state.par}</b>`,
        `${i18n.t('matching')}: <b>${PatternEngine.rightCount(state)}/${state.n}</b>`
    ].map(text => `<span>${text}</span>`).join('');
    undoBtn.disabled = solved || !history.length;
}

/* ---------- Playing ---------- */

function tapCell(i) {
    if (!state || solved) return;
    if (selected === null) {
        selected = i;
    } else if (selected === i) {
        selected = null;
    } else if (PatternEngine.isNeighbour(state, selected, i)) {
        trySwap(selected, i);
        return;
    } else {
        selected = i;
    }
    render();
}

// Swaps cells a and b if they hold different colours; returns whether it did
function trySwap(a, b) {
    if (solved || !PatternEngine.isNeighbour(state, a, b)) return false;
    if (!PatternEngine.canSwap(state, a, b)) {
        refuse(a, b);
        selected = null;
        render();
        return false;
    }
    const ids = [state.cells[a], state.cells[b]];
    PatternEngine.swap(state, a, b);
    history.push([a, b]);
    selected = null;
    moveTiles(ids);
    afterMove();
    return true;
}

function moveTiles(ids) {
    ids.forEach(id => {
        const el = tileEls[id];
        el.classList.add('moving');
        place(el, PatternEngine.cellOf(state, id));
        clearTimeout(el.movingTimer);
        el.movingTimer = setTimeout(() => el.classList.remove('moving'), SWAP_MS);
    });
}

function refuse(a, b) {
    [a, b].forEach(i => {
        const el = tileEls[state.cells[i]];
        el.classList.remove('nope');
        void el.offsetWidth;
        el.classList.add('nope');
        clearTimeout(el.nopeTimer);
        el.nopeTimer = setTimeout(() => el.classList.remove('nope'), 400);
    });
    setStatus('status_same');
}

function afterMove() {
    if (!PatternEngine.isSolved(state)) {
        if (statusKey !== 'status_play') setStatus('status_play');
        render();
        return;
    }
    solved = true;
    showCursor = false;
    setStatus(state.moves <= state.par ? 'status_perfect' : 'status_solved');
    Progress.markSolved(currentLevelIdx);
    render();
    const level = currentLevelIdx;
    setTimeout(() => { if (level === currentLevelIdx && solved) nextLevel(); }, 2000);
}

function undo() {
    if (solved || !history.length) return;
    const [a, b] = history.pop();
    const ids = [state.cells[a], state.cells[b]];
    PatternEngine.swap(state, a, b, true);
    selected = null;
    moveTiles(ids);
    setStatus('status_play');
    render();
}

function nextLevel() {
    if (currentLevelIdx + 1 < LevelRegistry.length) loadLevel(currentLevelIdx + 1);
    else setStatus('all_levels_cleared');
}

/* ---------- Status ---------- */

function setStatus(key) {
    statusKey = key;
    statusEl.innerText = i18n.t(key, { n: state ? state.moves : 0 });
}

function updateLevelInfo() {
    const level = LevelRegistry[currentLevelIdx];
    levelInfoEl.innerText = `${i18n.t('level')} ${currentLevelIdx + 1}/${LevelRegistry.length}: ${level.name}`;
}

/* ---------- Pointer input: tap, or drag onto a neighbour ---------- */

function cellFromEvent(e) {
    const el = e.target.closest('.tile');
    return el ? PatternEngine.cellOf(state, Number(el.dataset.id)) : -1;
}

board.addEventListener('pointerdown', (e) => {
    const i = cellFromEvent(e);
    suppressClick = false;
    if (i < 0 || solved) return;
    drag = { i, x: e.clientX, y: e.clientY, id: e.pointerId };
});

board.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < cell * DRAG_MIN) return;
    const dir = Math.abs(dx) > Math.abs(dy) ? [Math.sign(dx), 0] : [0, Math.sign(dy)];
    const from = drag.i;
    const to = PatternEngine.step(state, from, dir[0], dir[1]);
    drag = null;
    suppressClick = true;
    showCursor = false;
    if (to >= 0) {
        cursor = to;
        trySwap(from, to);
    }
});

board.addEventListener('pointerup', () => { drag = null; });
board.addEventListener('pointercancel', () => { drag = null; });

board.addEventListener('click', (e) => {
    if (suppressClick) {
        suppressClick = false;
        return;
    }
    const i = cellFromEvent(e);
    if (i < 0) return;
    showCursor = false;
    cursor = i;
    tapCell(i);
});

/* ---------- Keyboard ---------- */

document.addEventListener('keydown', (event) => {
    if (!state || document.querySelector('.modal.active')) return;
    const target = event.target instanceof Element ? event.target : null;
    if (target && target.closest('select, input')) return;
    const key = event.key;
    if (DIRS[key]) {
        const [dx, dy] = DIRS[key];
        const next = PatternEngine.step(state, cursor, dx, dy);
        showCursor = true;
        if (selected !== null) {
            if (next >= 0 && trySwap(selected, next)) cursor = next;
        } else if (next >= 0) {
            cursor = next;
        }
        render();
    } else if (key === 'Enter' || key === ' ') {
        if (target && target.closest('button, a')) return;
        showCursor = true;
        if (selected !== null && selected !== cursor) selected = null;
        tapCell(cursor);
    } else if (key === 'Escape') {
        if (selected === null) return;
        selected = null;
        render();
    } else if (key === 'z' || key === 'Z') {
        undo();
    } else return;
    event.preventDefault();
});

undoBtn.onclick = () => undo();
document.getElementById('restartBtn').onclick = () => loadLevel(currentLevelIdx);

window.addEventListener('resize', () => {
    if (state && cellSize() !== cell) layout();
});

window.addEventListener('langChanged', () => {
    setStatus(statusKey);
    updateLevelInfo();
    render();
});

if (LevelRegistry.length > 0) loadLevel(Progress.startLevel());
