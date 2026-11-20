/**
 * Quarter Turns page: tiles and handles are created once per level. A turn only
 * touches the four tiles involved: each is moved to its new cell and swung there
 * around the handle with the CSS rotate property (transform-origin = the handle).
 * Input: tap a handle to turn clockwise; right-click, shift-click or the direction
 * toggle turns counter-clockwise. Keys: arrows pick a handle, E / Space / Enter turn
 * clockwise, Q counter-clockwise, Z undoes.
 */
const TURN_MS = 260;
const SOLVED_DELAY = 2000;
const SYMBOLS = { r: '●', g: '▲', b: '■', y: '◆', p: '★', w: '○' };

let currentLevelIdx = 0;
let puzzle = null;
let cells = [];
let history = [];
let turns = 0;
let solved = false;
let statusKey = 'status_play';
let reverse = false;        // direction toggle for touch screens: true = counter-clockwise
let cursor = 0;             // handle picked with the keyboard
let showCursor = false;
let hovered = -1;
let tileEls = [];
let handleEls = [];

const board = document.getElementById('game-board');
const grid = document.getElementById('grid');
const preview = document.getElementById('goal-preview');
const statusEl = document.getElementById('status');
const levelInfoEl = document.getElementById('level-info');
const countersEl = document.getElementById('counters');
const undoBtn = document.getElementById('undoBtn');
const dirBtn = document.getElementById('dirBtn');

function loadLevel(idx) {
    const level = LevelRegistry[idx];
    if (!level) return;
    currentLevelIdx = idx;
    Progress.setCurrent(idx);
    puzzle = QuarterEngine.parse(level);
    cells = puzzle.labels.map((_, i) => i);
    history = [];
    turns = 0;
    solved = false;
    cursor = Math.min(cursor, puzzle.handles.length - 1);
    hovered = -1;
    setStatus('status_play');
    updateLevelInfo();
    buildPreview();
    buildBoard();
    renderCounters();
}

/* ---------- Building ---------- */

// Numbered tiles are tinted by the row they belong to in the target
function tileClass(label) {
    if (!puzzle.numeric) return `c-${label}`;
    const row = Math.floor(puzzle.target.indexOf(label) / puzzle.w);
    return `n-${row % 5}`;
}

function tileContent(label) {
    return puzzle.numeric ? label : SYMBOLS[label] || '';
}

function buildBoard() {
    const { w, h } = puzzle;
    board.style.setProperty('--w', w);
    board.style.setProperty('--h', h);
    board.classList.remove('solved');
    board.classList.toggle('numeric', puzzle.numeric);
    grid.innerHTML = '';
    tileEls = puzzle.labels.map((label, id) => {
        const el = document.createElement('div');
        el.className = `qtile ${tileClass(label)}${puzzle.fixed[id] ? ' fixed' : ''}`;
        el.innerHTML = `<span>${tileContent(label)}</span>`;
        grid.appendChild(el);
        return el;
    });
    cells.forEach((id, i) => placeTile(id, i));
    handleEls = puzzle.handles.map((hd, k) => {
        const el = document.createElement('div');
        el.className = 'handle';
        el.dataset.handle = k;
        el.setAttribute('role', 'button');
        el.style.left = `${(hd.c + 1) * 100 / w}%`;
        el.style.top = `${(hd.r + 1) * 100 / h}%`;
        grid.appendChild(el);
        return el;
    });
    renderHandles();
}

function placeTile(id, i) {
    const el = tileEls[id];
    el.style.translate = `${(i % puzzle.w) * 100}% ${Math.floor(i / puzzle.w) * 100}%`;
}

function renderHandles() {
    handleEls.forEach((el, k) => {
        el.classList.toggle('ccw', reverse);
        el.classList.toggle('cursor', showCursor && k === cursor);
        el.title = i18n.t(reverse ? 'turn_ccw' : 'turn_cw');
    });
    dirBtn.textContent = reverse ? `↺ ${i18n.t('dir_ccw')}` : `↻ ${i18n.t('dir_cw')}`;
    dirBtn.classList.toggle('active', reverse);
    highlight();
}

// Lifts the four tiles of the hovered (or keyboard-picked) handle
function highlight() {
    tileEls.forEach(el => el.classList.remove('lift'));
    const k = hovered >= 0 ? hovered : showCursor ? cursor : -1;
    if (k < 0 || solved || !puzzle.handles[k]) return;
    const hd = puzzle.handles[k];
    QuarterEngine.corners(puzzle.w, hd.r, hd.c).forEach(i => tileEls[cells[i]].classList.add('lift'));
}

function buildPreview() {
    const size = Math.floor(92 / Math.max(puzzle.w, puzzle.h));
    preview.innerHTML = `<div class="mini" style="grid-template-columns:repeat(${puzzle.w}, ${size}px);grid-auto-rows:${size}px">` +
        puzzle.target.map(label => `<i class="${tileClass(label)}">${puzzle.numeric ? label : ''}</i>`).join('') + '</div>';
}

/* ---------- Counters & status ---------- */

function renderCounters() {
    countersEl.innerHTML = [`${i18n.t('turns')}: ${turns}`, `${i18n.t('par')}: ${puzzle.par}`]
        .map(text => `<span>${text}</span>`).join('');
    undoBtn.disabled = !history.length || solved;
}

function setStatus(key) {
    statusKey = key;
    statusEl.innerText = i18n.t(key, { n: turns });
    statusEl.classList.toggle('win', key !== 'status_play');
}

function updateLevelInfo() {
    const level = LevelRegistry[currentLevelIdx];
    levelInfoEl.innerText = `${i18n.t('level')} ${currentLevelIdx + 1}/${LevelRegistry.length}: ${level.name}`;
}

/* ---------- Turning ---------- */

// Moves the tiles to their new cells, starting each one turned back by a quarter
// around the handle, then lets the rotate transition swing it into place
function animateTurn(moved, hd, dir) {
    const { w } = puzzle;
    moved.forEach(({ id, to }) => {
        const el = tileEls[id];
        el.style.transition = 'none';
        placeTile(id, to);
        el.style.transformOrigin = `${(hd.c + 1 - to % w) * 100}% ${(hd.r + 1 - Math.floor(to / w)) * 100}%`;
        el.style.rotate = `${-dir * 90}deg`;
        el.classList.add('turning');
    });
    void grid.offsetWidth;
    moved.forEach(({ id }) => {
        const el = tileEls[id];
        el.style.transition = `rotate ${TURN_MS}ms cubic-bezier(0.3, 0.1, 0.25, 1.15)`;
        el.style.rotate = '0deg';
        clearTimeout(el.turnTimer);
        el.turnTimer = setTimeout(() => el.classList.remove('turning'), TURN_MS);
    });
}

function turn(k, dir) {
    const hd = puzzle && puzzle.handles[k];
    if (!hd || solved) return;
    const moved = QuarterEngine.rotate(cells, puzzle.w, hd.r, hd.c, dir);
    animateTurn(moved, hd, dir);
    history.push({ k, dir });
    turns++;
    renderCounters();
    highlight();
    if (QuarterEngine.isSolved(cells, puzzle.labels, puzzle.target)) win();
}

function undo() {
    if (solved || !history.length) return;
    const { k, dir } = history.pop();
    const hd = puzzle.handles[k];
    animateTurn(QuarterEngine.rotate(cells, puzzle.w, hd.r, hd.c, -dir), hd, -dir);
    turns--;
    renderCounters();
    highlight();
}

function win() {
    solved = true;
    board.classList.add('solved');
    highlight();
    setStatus(turns <= puzzle.par ? 'status_perfect' : 'status_solved');
    Progress.markSolved(currentLevelIdx);
    renderCounters();
    const level = currentLevelIdx;
    setTimeout(() => { if (level === currentLevelIdx && solved) nextLevel(); }, SOLVED_DELAY);
}

function nextLevel() {
    if (currentLevelIdx + 1 < LevelRegistry.length) loadLevel(currentLevelIdx + 1);
    else setStatus('all_levels_cleared');
}

/* ---------- Input ---------- */

function handleIndex(event) {
    const el = event.target.closest('.handle');
    return el ? Number(el.dataset.handle) : -1;
}

grid.addEventListener('click', (event) => {
    const k = handleIndex(event);
    if (k < 0) return;
    showCursor = false;
    cursor = k;
    turn(k, event.shiftKey !== reverse ? -1 : 1);
    renderHandles();
});

grid.addEventListener('contextmenu', (event) => {
    const k = handleIndex(event);
    if (k < 0) return;
    event.preventDefault();
    turn(k, reverse ? 1 : -1);
});

grid.addEventListener('pointerover', (event) => {
    if (event.pointerType !== 'mouse') return;
    hovered = handleIndex(event);
    highlight();
});

grid.addEventListener('pointerleave', () => {
    hovered = -1;
    highlight();
});

dirBtn.onclick = () => {
    reverse = !reverse;
    renderHandles();
};
undoBtn.onclick = () => undo();
document.getElementById('restartBtn').onclick = () => loadLevel(currentLevelIdx);

// Moves the keyboard cursor to the nearest handle in a direction
function moveCursor(dr, dc) {
    const cur = puzzle.handles[cursor];
    let best = -1, bestScore = Infinity;
    puzzle.handles.forEach((hd, k) => {
        const along = (hd.r - cur.r) * dr + (hd.c - cur.c) * dc;
        if (along <= 0) return;
        const across = Math.abs((hd.r - cur.r) * dc) + Math.abs((hd.c - cur.c) * dr);
        const score = along + across * 2;
        if (score < bestScore) { bestScore = score; best = k; }
    });
    if (best >= 0) cursor = best;
}

const KEY_DIRS = { arrowup: [-1, 0], arrowdown: [1, 0], arrowleft: [0, -1], arrowright: [0, 1] };

document.addEventListener('keydown', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const key = event.key.toLowerCase();
    if (target && target.closest('select, input')) return;
    // Enter / Space on a focused button press that button
    if (target && target.closest('button') && (key === ' ' || key === 'enter')) return;
    if (document.querySelector('.modal.active') || !puzzle) return;
    if (KEY_DIRS[key]) {
        if (showCursor) moveCursor(...KEY_DIRS[key]);
        showCursor = true;
        renderHandles();
    } else if (key === 'e' || key === ' ' || key === 'enter') {
        showCursor = true;
        turn(cursor, event.shiftKey !== reverse ? -1 : 1);
        renderHandles();
    } else if (key === 'q') {
        showCursor = true;
        turn(cursor, reverse ? 1 : -1);
        renderHandles();
    } else if (key === 'z' || key === 'backspace') {
        undo();
    } else return;
    event.preventDefault();
});

window.addEventListener('langChanged', () => {
    setStatus(statusKey);
    updateLevelInfo();
    renderCounters();
    renderHandles();
});

if (LevelRegistry.length > 0) loadLevel(Progress.startLevel());
