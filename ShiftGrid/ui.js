/**
 * Shift Grid page. The tiles are absolutely placed elements that are built once
 * per level and only moved afterwards. A shifted row or column slides by one cell
 * (time-based animation); a "ghost" copy of the line shows the tile that wraps
 * around the edge. Dragging a line previews the shift live and snaps to whole cells.
 * Keys: arrows move the cursor, Shift+arrow shifts the cursor's row or column, Z undoes.
 */
const SHIFT_MS = 150;
const ARROW = 26;
const GAP = 4;
const GLYPHS = { R: '●', G: '▲', B: '■', Y: '◆', P: '★', O: '✚' };

let currentLevelIdx = 0;
let state = null;
let history = [];
let moves = 0;
let solved = false;
let statusKey = 'status_play';
let cell = 48;
let cursor = { x: 0, y: 0 };
let tileEls = [];   // tileEls[cellIndex] = the element showing that cell's tile
let anim = null;    // the running slide: { cells, axis, from, start, ghosts }
let drag = null;

const frame = document.getElementById('frame');
const targetEl = document.getElementById('target');
const statusEl = document.getElementById('status');
const levelInfoEl = document.getElementById('level-info');
const countersEl = document.getElementById('counters');
const undoBtn = document.getElementById('undoBtn');
let boardEl = null;
let cursorEl = null;

function loadLevel(idx) {
    const level = LevelRegistry[idx];
    if (!level) return;
    finishAnim();
    drag = null;
    currentLevelIdx = idx;
    Progress.setCurrent(idx);
    state = ShiftEngine.parse(level);
    history = [];
    moves = 0;
    solved = false;
    cursor = { x: 0, y: 0 };
    setStatus('status_play');
    updateLevelInfo();
    buildTarget();
    buildBoard();
    update();
}

/* ---------- Building ---------- */

function cellSize() {
    const app = document.getElementById('app');
    const width = Math.min(app.clientWidth - 32, 460);
    return Math.max(30, Math.min(72, Math.floor((width - 2 * (ARROW + GAP)) / state.n)));
}

// A tile's look: a colour with its glyph, or a number tinted by the row it belongs in
function tileClass(token) {
    if (state.numbered) {
        const row = Math.floor((Number(token) - 1) / state.n);
        return `num c-${ShiftEngine.COLOURS[row % ShiftEngine.COLOURS.length]}`;
    }
    return `c-${token}`;
}

function tileHtml(token) {
    return `<span>${state.numbered ? token : GLYPHS[token] || ''}</span>`;
}

function buildTarget() {
    const n = state.n;
    const size = Math.floor(104 / n);
    targetEl.style.gridTemplateColumns = `repeat(${n}, ${size}px)`;
    targetEl.style.gridAutoRows = `${size}px`;
    targetEl.style.fontSize = `${Math.max(8, Math.floor(size * 0.5))}px`;
    targetEl.innerHTML = state.target.map(t => `<i class="${tileClass(t)}">${state.numbered ? t : ''}</i>`).join('');
}

function buildBoard() {
    const n = state.n;
    cell = cellSize();
    sizeFrame();
    frame.innerHTML = '';

    // Strips of arrow buttons at both ends of every row and column
    const strip = (cls, col, row, line, d, label) => {
        const el = document.createElement('div');
        el.className = `strip ${cls}`;
        el.style.gridColumn = col;
        el.style.gridRow = row;
        for (let i = 0; i < n; i++) {
            const b = document.createElement('button');
            b.className = 'arrow';
            b.textContent = label;
            b.dataset.line = line;
            b.dataset.i = i;
            b.dataset.d = d;
            b.tabIndex = -1;
            b.setAttribute('aria-label', `${line === 'r' ? 'row' : 'column'} ${i + 1} ${label}`);
            el.appendChild(b);
        }
        frame.appendChild(el);
    };
    strip('h', 2, 1, 'c', -1, '▲');
    strip('h', 2, 3, 'c', 1, '▼');
    strip('v', 1, 2, 'r', -1, '◀');
    strip('v', 3, 2, 'r', 1, '▶');

    boardEl = document.createElement('div');
    boardEl.className = 'board';
    boardEl.style.gridColumn = 2;
    boardEl.style.gridRow = 2;
    frame.appendChild(boardEl);

    tileEls = state.grid.map((token, c) => {
        const el = document.createElement('div');
        el.className = `tile ${tileClass(token)}`;
        el.innerHTML = tileHtml(token);
        boardEl.appendChild(el);
        place(el, c % n, Math.floor(c / n));
        return el;
    });
    cursorEl = document.createElement('div');
    cursorEl.className = 'cursor';
    boardEl.appendChild(cursorEl);
}

function sizeFrame() {
    frame.style.setProperty('--cell', `${cell}px`);
    frame.style.setProperty('--n', state.n);
    frame.style.gridTemplateColumns = frame.style.gridTemplateRows = `${ARROW}px ${state.n * cell}px ${ARROW}px`;
}

function place(el, x, y) {
    placePx(el, x * cell, y * cell);
}

// Pixel placement (used while sliding)
function placePx(el, px, py) {
    el.style.transform = `translate(${px}px, ${py}px)`;
}

/* ---------- Sliding a line ---------- */

// Shows the line `cells` (cell indexes, in order) moved by `off` pixels along it, wrapping around
function showLineOffset(cells, axis, off, ghosts) {
    const n = state.n;
    const span = n * cell;
    cells.forEach((c, k) => {
        const p = (((k * cell + off) % span) + span) % span;
        const fixed = axis === 'r' ? Math.floor(c / n) * cell : (c % n) * cell;
        const [x, y] = axis === 'r' ? [p, fixed] : [fixed, p];
        const [gx, gy] = axis === 'r' ? [p - span, fixed] : [fixed, p - span];
        placePx(tileEls[c], x, y);
        placePx(ghosts[k], gx, gy);
    });
}

function makeGhosts(cells) {
    return cells.map(c => {
        const g = tileEls[c].cloneNode(true);
        g.classList.add('ghost');
        boardEl.appendChild(g);
        return g;
    });
}

function settleLine(cells, ghosts) {
    const n = state.n;
    ghosts.forEach(g => g.remove());
    cells.forEach(c => place(tileEls[c], c % n, Math.floor(c / n)));
}

// Slides a line that has already moved in the state from offset `from` (pixels) to 0
function animateLine(line, i, from) {
    finishAnim();
    const cells = ShiftEngine.line(state.n, line, i);
    const ghosts = makeGhosts(cells);
    anim = { cells, line, from, ghosts, start: performance.now() };
    showLineOffset(cells, line, from, ghosts);
    const id = anim;
    const step = (now) => {
        if (anim !== id) return;
        const t = Math.min(1, (now - id.start) / SHIFT_MS);
        const ease = 1 - (1 - t) ** 3;
        if (t < 1) {
            showLineOffset(cells, line, from * (1 - ease), ghosts);
            requestAnimationFrame(step);
        } else {
            finishAnim();
        }
    };
    requestAnimationFrame(step);
}

function finishAnim() {
    if (!anim) return;
    const a = anim;
    anim = null;
    settleLine(a.cells, a.ghosts);
}

/* ---------- Moves ---------- */

// Applies one move to the state and the element map (no animation)
function commit(move) {
    state.grid = ShiftEngine.apply(state.grid, state.n, move);
    tileEls = ShiftEngine.apply(tileEls, state.n, move);
}

function shift(line, i, d) {
    if (!state || solved) return;
    finishAnim();
    const move = { line, i, d };
    commit(move);
    history.push(move);
    moves++;
    followCursor(move);
    animateLine(line, i, -d * cell);
    afterMove();
}

// The keyboard cursor stays on its tile when that tile's line moves
function followCursor(move) {
    const n = state.n;
    if (move.line === 'r' && cursor.y === move.i) cursor.x = (cursor.x + move.d + n) % n;
    if (move.line === 'c' && cursor.x === move.i) cursor.y = (cursor.y + move.d + n) % n;
}

function undo() {
    if (!state || solved || !history.length) return;
    finishAnim();
    const move = ShiftEngine.inverse(history.pop());
    commit(move);
    moves--;
    followCursor(move);
    animateLine(move.line, move.i, -move.d * cell);
    setStatus('status_play');
    update();
}

function afterMove() {
    if (ShiftEngine.isSolved(state.grid, state.target)) {
        solved = true;
        const perfect = moves <= state.par;
        setStatus(perfect ? 'status_perfect' : 'status_solved');
        Progress.markSolved(currentLevelIdx);
        const id = currentLevelIdx;
        setTimeout(() => { if (id === currentLevelIdx && solved) nextLevel(); }, 2000);
    }
    update();
}

function nextLevel() {
    if (currentLevelIdx + 1 < LevelRegistry.length) loadLevel(currentLevelIdx + 1);
    else setStatus('all_levels_cleared');
}

/* ---------- Rendering ---------- */

function update() {
    const parText = state.exact ? `${i18n.t('par')}: ${state.par}` : i18n.t('par_bound', { n: state.par });
    countersEl.innerText = `${i18n.t('moves')}: ${moves} · ${parText}`;
    undoBtn.disabled = solved || !history.length;
    frame.classList.toggle('solved', solved);
    frame.querySelectorAll('.arrow').forEach(b => { b.disabled = solved; });
    placePx(cursorEl, cursor.x * cell, cursor.y * cell);
}

/* ---------- Input: arrows, dragging, keys ---------- */

frame.addEventListener('click', (e) => {
    const b = e.target.closest('.arrow');
    if (!b) return;
    shift(b.dataset.line, Number(b.dataset.i), Number(b.dataset.d));
});

frame.addEventListener('pointerdown', (e) => {
    if (!state || solved || !boardEl.contains(e.target) || e.button > 0) return;
    finishAnim();
    const r = boardEl.getBoundingClientRect();
    const x = Math.min(state.n - 1, Math.max(0, Math.floor((e.clientX - r.left) / cell)));
    const y = Math.min(state.n - 1, Math.max(0, Math.floor((e.clientY - r.top) / cell)));
    drag = { x, y, sx: e.clientX, sy: e.clientY, line: null, off: 0, cells: null, ghosts: null, id: e.pointerId };
    boardEl.setPointerCapture?.(e.pointerId);
    frame.classList.remove('keys');
    cursor = { x, y };
    update();
});

frame.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.sx;
    const dy = e.clientY - drag.sy;
    if (!drag.line) {
        if (Math.hypot(dx, dy) < 6) return;
        drag.line = Math.abs(dx) >= Math.abs(dy) ? 'r' : 'c';
        drag.i = drag.line === 'r' ? drag.y : drag.x;
        drag.cells = ShiftEngine.line(state.n, drag.line, drag.i);
        drag.ghosts = makeGhosts(drag.cells);
        drag.cells.forEach(c => tileEls[c].classList.add('lifted'));
        drag.ghosts.forEach(g => g.classList.add('lifted'));
    }
    drag.off = drag.line === 'r' ? dx : dy;
    showLineOffset(drag.cells, drag.line, drag.off, drag.ghosts);
});

function endDrag(e) {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag;
    drag = null;
    if (!d.line) return;
    const n = state.n;
    d.cells.forEach(c => tileEls[c].classList.remove('lifted'));
    d.ghosts.forEach(g => g.remove());
    const k = Math.round(d.off / cell);
    // The shortest equivalent shift: dragging 2 cells right on a 3-wide grid is 1 cell left
    let steps = ((k % n) + n) % n;
    if (steps > n / 2) steps -= n;
    const dir = Math.sign(steps);
    for (let s = 0; s < Math.abs(steps); s++) {
        const move = { line: d.line, i: d.i, d: dir };
        commit(move);
        history.push(move);
        moves++;
        followCursor(move);
    }
    // The line now sits at its new cells; slide it from where the pointer left it
    animateLine(d.line, d.i, d.off - k * cell);
    if (steps) afterMove();
    else update();
}

frame.addEventListener('pointerup', endDrag);
frame.addEventListener('pointercancel', endDrag);

document.addEventListener('keydown', (event) => {
    const inFormControl = event.target instanceof Element && event.target.closest('select, input');
    if (inFormControl || document.querySelector('.modal.active') || !state) return;
    const dirs = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
    const n = state.n;
    if (dirs[event.key]) {
        const [dx, dy] = dirs[event.key];
        frame.classList.add('keys');
        if (event.shiftKey) {
            if (dx) shift('r', cursor.y, dx);
            else shift('c', cursor.x, dy);
        } else {
            cursor = { x: (cursor.x + dx + n) % n, y: (cursor.y + dy + n) % n };
            update();
        }
    } else if (event.key === 'z' || event.key === 'Z' || event.key === 'Backspace') {
        undo();
    } else {
        return;
    }
    event.preventDefault();
});

undoBtn.onclick = undo;
document.getElementById('restartBtn').onclick = () => loadLevel(currentLevelIdx);

/* ---------- Status ---------- */

function setStatus(key) {
    statusKey = key;
    statusEl.innerText = i18n.t(key, { n: moves });
}

function updateLevelInfo() {
    const level = LevelRegistry[currentLevelIdx];
    levelInfoEl.innerText = `${i18n.t('level')} ${currentLevelIdx + 1}/${LevelRegistry.length}: ${level.name}`;
}

window.addEventListener('resize', () => {
    if (!state || drag) return;
    const size = cellSize();
    if (size === cell) return;
    finishAnim();
    cell = size;
    sizeFrame();
    tileEls.forEach((el, c) => place(el, c % state.n, Math.floor(c / state.n)));
    update();
});

window.addEventListener('langChanged', () => {
    setStatus(statusKey);
    updateLevelInfo();
    update();
});

if (LevelRegistry.length > 0) loadLevel(Progress.startLevel());
