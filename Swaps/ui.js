/**
 * Swaps page: tap a tile, then another one, and the two trade places.
 * Tiles keep their DOM elements for the whole level and are moved with CSS
 * transforms, so a swap only touches the two tiles involved.
 * Keyboard: arrows move the cursor, Enter / Space pick a tile and swap,
 * Escape drops the pick, Z undoes.
 */
const SWAP_MS = 260;
const SUIT_SHAPES = ['circle', 'triangle', 'square', 'diamond'];

let currentLevelIdx = 0;
let state = null;
let history = [];
let solved = false;
let selected = null; // cell index of the picked tile
let cursor = 0;
let showCursor = false;
let statusKey = 'status_play';
let cell = 64;
let tileEls = {}; // tile number -> element
let cursorEl = null;

const board = document.getElementById('board');
const preview = document.getElementById('target-preview');
const statusEl = document.getElementById('status');
const levelInfoEl = document.getElementById('level-info');
const countersEl = document.getElementById('counters');
const ruleEl = document.getElementById('rule-badge');
const undoBtn = document.getElementById('undoBtn');

function loadLevel(idx) {
    const level = LevelRegistry[idx];
    if (!level) return;
    currentLevelIdx = idx;
    Progress.setCurrent(idx);
    state = SwapsEngine.parse(level);
    history = [];
    solved = false;
    selected = null;
    cursor = 0;
    setStatus('status_play');
    updateLevelInfo();
    buildPreview();
    buildBoard();
    render();
}

/* ---------- Building (once per level) ---------- */

function cellSize() {
    const room = Math.min(440, document.getElementById('app').clientWidth - 32) - 16;
    return Math.max(36, Math.min(88, Math.floor(room / state.cols)));
}

// The face of tile t: a number, a shape with a value, or a piece of the picture
function faceHtml(t) {
    if (state.face === 'suit') {
        const shape = SUIT_SHAPES[Math.floor((t - 1) / 4)];
        return `<span class="val">${(t - 1) % 4 + 1}</span><span class="shape ${shape}"></span>`;
    }
    if (state.face === 'picture') return `<span class="corner">${t}</span>`;
    return `<span class="num">${t}</span>`;
}

function pieceStyle(t) {
    const home = state.goal.indexOf(t);
    const [gx, gy] = SwapsEngine.xy(state, home);
    const px = state.cols > 1 ? (gx / (state.cols - 1)) * 100 : 0;
    const py = state.rows > 1 ? (gy / (state.rows - 1)) * 100 : 0;
    return `background-image: var(--picture); background-size: ${state.cols * 100}% ${state.rows * 100}%; background-position: ${px}% ${py}%`;
}

function buildBoard() {
    board.innerHTML = '';
    board.className = `board face-${state.face}`;
    if (state.picture) board.style.setProperty('--picture', SwapsPictures.url(state.picture, state.cols, state.rows));
    else board.style.removeProperty('--picture');
    tileEls = {};
    for (let i = 0; i < state.n; i++) {
        const t = state.cells[i];
        const el = document.createElement('div');
        el.className = 'tile';
        el.dataset.tile = t;
        const style = state.face === 'picture' ? ` style="${pieceStyle(t)}"` : '';
        el.innerHTML = `<div class="face"${style}>${faceHtml(t)}</div>`;
        board.appendChild(el);
        tileEls[t] = el;
    }
    cursorEl = document.createElement('div');
    cursorEl.className = 'cursor';
    board.appendChild(cursorEl);
    layout();
}

// Sizes the board and puts every tile at its cell (also used on resize)
function layout() {
    cell = cellSize();
    board.style.setProperty('--cell', `${cell}px`);
    board.style.width = `${state.cols * cell + 16}px`;
    board.style.height = `${state.rows * cell + 16}px`;
    board.classList.add('instant');
    state.cells.forEach((t, i) => place(tileEls[t], i));
    placeCursor();
    void board.offsetWidth; // apply the positions before transitions come back
    board.classList.remove('instant');
}

function place(el, i) {
    const [x, y] = SwapsEngine.xy(state, i);
    el.style.transform = `translate(${x * cell}px, ${y * cell}px)`;
}

function placeCursor() {
    const [x, y] = SwapsEngine.xy(state, cursor);
    cursorEl.style.transform = `translate(${x * cell}px, ${y * cell}px)`;
    cursorEl.hidden = !showCursor || solved;
}

function buildPreview() {
    const size = Math.max(12, Math.min(26, Math.floor(Math.min(150 / state.cols, 104 / state.rows))));
    preview.style.setProperty('--mini', `${size}px`);
    if (state.face === 'picture') {
        preview.innerHTML = `<div class="mini-picture" style="width:${state.cols * size}px; height:${state.rows * size}px; background-image:${SwapsPictures.url(state.picture, state.cols, state.rows)}"></div>`;
        return;
    }
    const cells = state.goal.map(t => {
        if (state.face === 'suit') {
            return `<i class="mini-suit"><span class="shape ${SUIT_SHAPES[Math.floor((t - 1) / 4)]}"></span><b>${(t - 1) % 4 + 1}</b></i>`;
        }
        return `<i>${t}</i>`;
    });
    preview.innerHTML = `<div class="mini" style="grid-template-columns: repeat(${state.cols}, var(--mini))">${cells.join('')}</div>`;
}

/* ---------- Rendering (class toggles only) ---------- */

function render() {
    state.cells.forEach((t, i) => {
        const el = tileEls[t];
        el.classList.toggle('home', SwapsEngine.isHome(state, i));
        el.classList.toggle('selected', selected === i);
        const restricted = selected !== null && state.rule !== 'any' && selected !== i;
        el.classList.toggle('reach', restricted && SwapsEngine.canSwap(state, selected, i));
        el.classList.toggle('dim', restricted && !SwapsEngine.canSwap(state, selected, i));
    });
    board.classList.toggle('solved', solved);
    placeCursor();
    ruleEl.innerText = i18n.t(`swap_${state.rule}`);
    ruleEl.className = `rule-badge rule-${state.rule}`;
    countersEl.innerHTML = [
        `${i18n.t('swaps')}: <b>${state.moves}</b>`,
        `${i18n.t('par')}: <b>${state.par}</b>`,
        `${i18n.t('home')}: <b>${SwapsEngine.homeCount(state)}/${state.n}</b>`
    ].map(text => `<span>${text}</span>`).join('');
    undoBtn.disabled = solved || !history.length;
}

/* ---------- Playing ---------- */

// Tapping a cell: pick it, drop the pick, or swap with the picked tile
function tapCell(i) {
    if (!state || solved) return;
    if (selected === null) {
        selected = i;
    } else if (selected === i) {
        selected = null;
    } else if (SwapsEngine.canSwap(state, selected, i)) {
        doSwap(selected, i);
        return;
    } else {
        refuse(i);
        selected = i;
    }
    render();
}

function doSwap(a, b) {
    const ta = state.cells[a];
    const tb = state.cells[b];
    SwapsEngine.swap(state, a, b);
    history.push([a, b]);
    selected = null;
    moveTiles(ta, tb);
    afterMove();
}

// Moves only the two swapped tiles; they ride above the others while moving
function moveTiles(ta, tb) {
    [ta, tb].forEach(t => {
        const el = tileEls[t];
        el.classList.add('moving');
        place(el, SwapsEngine.cellOf(state, t));
        clearTimeout(el.movingTimer);
        el.movingTimer = setTimeout(() => el.classList.remove('moving'), SWAP_MS);
    });
}

function refuse(i) {
    const el = tileEls[state.cells[i]];
    el.classList.remove('nope');
    void el.offsetWidth;
    el.classList.add('nope');
    clearTimeout(el.nopeTimer);
    el.nopeTimer = setTimeout(() => el.classList.remove('nope'), 400);
    setStatus(`illegal_${state.rule}`);
}

function afterMove() {
    if (!SwapsEngine.isSolved(state)) {
        if (statusKey !== 'status_play') setStatus('status_play');
        render();
        return;
    }
    solved = true;
    setStatus(state.moves <= state.par ? 'status_perfect' : 'status_solved');
    Progress.markSolved(currentLevelIdx);
    render();
    const level = currentLevelIdx;
    setTimeout(() => { if (level === currentLevelIdx && solved) nextLevel(); }, 2000);
}

function undo() {
    if (solved || !history.length) return;
    const [a, b] = history.pop();
    const ta = state.cells[a];
    const tb = state.cells[b];
    SwapsEngine.swap(state, a, b, true);
    selected = null;
    moveTiles(ta, tb);
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

/* ---------- Input ---------- */

board.addEventListener('click', (e) => {
    const el = e.target.closest('.tile');
    if (!el) return;
    const i = SwapsEngine.cellOf(state, Number(el.dataset.tile));
    showCursor = false;
    cursor = i;
    tapCell(i);
});

document.addEventListener('keydown', (event) => {
    if (!state || document.querySelector('.modal.active')) return;
    const target = event.target instanceof Element ? event.target : null;
    if (target && target.closest('select, input')) return;
    const steps = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
    const key = event.key;
    if (steps[key]) {
        const [x, y] = SwapsEngine.xy(state, cursor);
        const nx = Math.min(state.cols - 1, Math.max(0, x + steps[key][0]));
        const ny = Math.min(state.rows - 1, Math.max(0, y + steps[key][1]));
        cursor = ny * state.cols + nx;
        showCursor = true;
        render();
    } else if (key === 'Enter' || key === ' ') {
        if (target && target.closest('button, a')) return; // let the focused button work
        showCursor = true;
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
