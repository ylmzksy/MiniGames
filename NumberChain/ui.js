/**
 * Number Chain page: tap a cell, then type its number (digits typed quickly
 * join, Enter confirms) or use the pad below the board, whose "Likely" buttons
 * offer one more / one less than the numbers around the cell.
 * Keyboard: arrows move, digits type, Enter confirms, Backspace / Delete erase,
 * Z undoes.
 */
let currentLevelIdx = 0;
let puzzle = null;
let values = [];
let history = [];
let solved = false;
let selected = -1;
let pending = null; // { cell, text, time, timer }: digits typed but not yet placed
let statusKey = 'status_play';
let statusParams = {};
let startTime = 0;
let elapsed = 0;
let timer = null;

const JOIN_MS = 1200; // digits typed within this time join into one number

const board = document.getElementById('game-board');
const statusEl = document.getElementById('status');
const levelInfoEl = document.getElementById('level-info');
const modeEl = document.getElementById('mode');
const countersEl = document.getElementById('counters');
const padEl = document.getElementById('pad');
const suggestionsEl = document.getElementById('suggestions');
const SVG_NS = 'http://www.w3.org/2000/svg';

function loadLevel(idx) {
    const level = LevelRegistry[idx];
    if (!level) return;
    currentLevelIdx = idx;
    Progress.setCurrent(idx);
    puzzle = ChainEngine.parse(level);
    values = ChainEngine.start(puzzle);
    history = [];
    solved = false;
    dropPending();
    selected = values.findIndex(v => v === 0);
    clearInterval(timer);
    timer = null;
    elapsed = 0;
    setStatus('status_play');
    updateLevelInfo();
    buildBoard();
    afterChange(false);
}

const isGiven = i => puzzle.givens[i] > 0;
const isHole = i => puzzle.holes[i];

/* ---------- Timer ---------- */

function startTimer() {
    if (timer || solved) return;
    startTime = Date.now() - elapsed;
    timer = setInterval(() => { elapsed = Date.now() - startTime; renderCounters(); }, 500);
}

function formatTime(ms) {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/* ---------- Board ---------- */

// Built once per level; afterwards only changed cells, classes and chain links are touched
let cellEls = [];
let tileEls = [];
let linkLayer = null;
let linkEls = new Map(); // "a-b" → <line>

function buildBoard() {
    const { width, height } = puzzle;
    board.style.setProperty('--cols', width);
    board.style.aspectRatio = `${width} / ${height}`;
    board.innerHTML = '';
    cellEls = [];
    tileEls = [];
    linkEls = new Map();

    // Tiles and chain links are drawn in one SVG beneath the cells, in grid units
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'chain');
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    const tiles = document.createElementNS(SVG_NS, 'g');
    linkLayer = document.createElementNS(SVG_NS, 'g');
    linkLayer.setAttribute('class', 'links');
    svg.append(tiles, linkLayer);

    const grid = document.createElement('div');
    grid.className = 'cells';
    grid.style.gridTemplateColumns = `repeat(${width}, 1fr)`;
    grid.style.gridTemplateRows = `repeat(${height}, 1fr)`;
    values.forEach((v, i) => {
        const x = i % width;
        const y = Math.floor(i / width);
        let tile = null;
        if (!isHole(i)) {
            tile = document.createElementNS(SVG_NS, 'rect');
            tile.setAttribute('x', x + 0.04);
            tile.setAttribute('y', y + 0.04);
            tile.setAttribute('width', 0.92);
            tile.setAttribute('height', 0.92);
            tile.setAttribute('rx', 0.16);
            tile.setAttribute('class', 'tile');
            tiles.appendChild(tile);
        }
        tileEls.push(tile);
        const cell = document.createElement('div');
        cell.className = isHole(i) ? 'cell hole' : `cell ${isGiven(i) ? 'given' : ''}`;
        cell.dataset.i = i;
        cell.innerHTML = '<span class="bead"></span>';
        grid.appendChild(cell);
        cellEls.push(cell);
        paintCell(i);
    });
    board.append(svg, grid);
}

// Redraws the number of one cell (or the digits still being typed into it)
function paintCell(i) {
    if (isHole(i)) return;
    const cell = cellEls[i];
    const typing = pending && pending.cell === i;
    const v = typing ? pending.text : values[i];
    cell.firstElementChild.textContent = v ? String(v) : '';
    cell.classList.toggle('filled', !!v);
    cell.classList.toggle('pending', !!typing);
}

function paintChanges(before) {
    before.forEach((v, i) => { if (v !== values[i]) paintCell(i); });
}

// Adds chain lines that appeared and removes those that broke
function renderLinks(links) {
    const seen = new Set();
    links.forEach(([a, b]) => {
        const key = `${a}-${b}`;
        seen.add(key);
        if (linkEls.has(key)) return;
        const w = puzzle.width;
        const line = document.createElementNS(SVG_NS, 'line');
        line.setAttribute('x1', a % w + 0.5);
        line.setAttribute('y1', Math.floor(a / w) + 0.5);
        line.setAttribute('x2', b % w + 0.5);
        line.setAttribute('y2', Math.floor(b / w) + 0.5);
        linkLayer.appendChild(line);
        linkEls.set(key, line);
    });
    linkEls.forEach((line, key) => {
        if (!seen.has(key)) { line.remove(); linkEls.delete(key); }
    });
}

let lastCheck = null;

// Conflict marks, selection and the solved look are class toggles, so nothing else is redrawn
function render() {
    const { bad, links } = lastCheck;
    const near = new Set(selected >= 0 ? puzzle.neighbours[selected] : []);
    cellEls.forEach((cell, i) => {
        if (isHole(i)) return;
        cell.classList.toggle('bad', bad.has(i));
        cell.classList.toggle('selected', i === selected);
        tileEls[i].classList.toggle('near', near.has(i));
        tileEls[i].classList.toggle('sel', i === selected);
    });
    renderLinks(links);
    board.classList.toggle('solved', solved);
    document.getElementById('undoBtn').disabled = solved || !history.length;
    renderPad();
    renderCounters();
}

function renderCounters() {
    const filled = lastCheck ? lastCheck.filled : 0;
    countersEl.innerText = `${i18n.t('placed')}: ${filled}/${puzzle.total} · ${formatTime(elapsed)}`;
}

function renderPad() {
    const editable = !solved && selected >= 0 && !isGiven(selected);
    padEl.classList.toggle('disabled', !editable);
    padEl.querySelectorAll('button').forEach(b => { b.disabled = !editable; });
    const options = editable ? ChainEngine.candidates(puzzle, values, selected) : [];
    if (!options.length) {
        suggestionsEl.innerHTML = `<span class="none">${editable ? i18n.t('suggest_none') : ''}</span>`;
        return;
    }
    suggestionsEl.innerHTML = options
        .map(n => `<button class="chip ${values[selected] === n ? 'on' : ''}" data-value="${n}">${n}</button>`)
        .join('');
}

function updateMode() {
    const icon = puzzle.diagonal
        ? '<path d="M8 8V1.5M8 8V14.5M8 8H1.5M8 8H14.5M8 8L3 3M8 8L13 3M8 8L3 13M8 8L13 13"/>'
        : '<path d="M8 8V1.5M8 8V14.5M8 8H1.5M8 8H14.5"/>';
    modeEl.innerHTML = `<svg viewBox="0 0 16 16" aria-hidden="true">${icon}<circle cx="8" cy="8" r="2.2"/></svg>` +
        `<span>${i18n.t(puzzle.diagonal ? 'mode_diag' : 'mode_orth')}</span>`;
    modeEl.classList.toggle('diag', puzzle.diagonal);
}

/* ---------- Playing ---------- */

function setCell(i, v) {
    if (solved || i < 0 || isHole(i) || isGiven(i) || values[i] === v) return;
    history.push([...values]);
    if (history.length > 300) history.shift();
    values[i] = v;
    paintCell(i);
    startTimer();
    afterChange(true);
}

function afterChange(byPlayer) {
    lastCheck = ChainEngine.check(puzzle, values);
    if (byPlayer && ChainEngine.isSolved(puzzle, values)) {
        solved = true;
        dropPending();
        clearInterval(timer);
        timer = null;
        setStatus('status_solved', { time: formatTime(elapsed) });
        Progress.markSolved(currentLevelIdx);
        render();
        const id = currentLevelIdx;
        setTimeout(() => { if (id === currentLevelIdx && solved) nextLevel(); }, 2200);
        return;
    }
    if (lastCheck.bad.size) setStatus('status_conflict');
    else if (byPlayer || statusKey === 'status_conflict') setStatus('status_play');
    render();
}

/* ---------- Typing numbers ---------- */

function dropPending() {
    if (!pending) return;
    clearTimeout(pending.timer);
    const cell = pending.cell;
    pending = null;
    if (puzzle && cellEls[cell]) paintCell(cell);
}

// Places the digits typed so far
function commitPending() {
    if (!pending) return;
    const { cell, text } = pending;
    dropPending();
    const v = Number(text);
    if (v < 1 || v > puzzle.total) {
        setStatus('status_range', { n: puzzle.total });
        return;
    }
    setCell(cell, v);
}

function typeDigit(d) {
    if (solved || selected < 0) return;
    if (isGiven(selected)) { setStatus('status_given'); return; }
    const now = Date.now();
    let text = d;
    if (pending && pending.cell === selected && now - pending.time < JOIN_MS) text = pending.text + d;
    else commitPending();
    if (Number(text) > puzzle.total) text = d; // too big to join: start a new number
    if (text === '0') { dropPending(); setStatus('status_range', { n: puzzle.total }); return; }
    if (pending) clearTimeout(pending.timer);
    pending = { cell: selected, text, time: now, timer: null };
    paintCell(selected);
    // No longer number can start with these digits: place it right away
    if (Number(text) * 10 > puzzle.total) { commitPending(); return; }
    pending.timer = setTimeout(commitPending, JOIN_MS);
}

function erase() {
    if (pending) { dropPending(); return; }
    if (selected < 0 || solved) return;
    if (isGiven(selected)) { setStatus('status_given'); return; }
    setCell(selected, 0);
}

function select(i) {
    if (i === selected) return;
    commitPending();
    selected = i;
    render();
}

board.addEventListener('click', (e) => {
    const cell = e.target.closest('.cell');
    if (!cell) return;
    const i = Number(cell.dataset.i);
    if (isHole(i)) { setStatus('status_hole'); return; }
    select(i);
});

padEl.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn || btn.disabled) return;
    if (btn.dataset.value) {
        dropPending();
        setCell(selected, Number(btn.dataset.value));
        return;
    }
    const key = btn.dataset.key;
    if (key === 'erase') erase();
    else if (key === 'enter') commitPending();
    else if (key) typeDigit(key);
});

function undo() {
    dropPending();
    if (solved || !history.length) return;
    const before = values;
    values = history.pop();
    paintChanges(before);
    afterChange(true);
}

// Moves the selection one cell, jumping over holes
function move(dx, dy) {
    const { width, height } = puzzle;
    if (selected < 0) { select(values.findIndex(v => v !== null)); return; }
    let x = selected % width;
    let y = Math.floor(selected / width);
    for (;;) {
        x += dx;
        y += dy;
        if (x < 0 || y < 0 || x >= width || y >= height) return;
        if (!isHole(y * width + x)) { select(y * width + x); return; }
    }
}

document.addEventListener('keydown', (event) => {
    const inFormControl = event.target instanceof Element && event.target.closest('select, input');
    if (inFormControl || document.querySelector('.modal.active') || !puzzle) return;
    const moves = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
    if (moves[event.key]) move(...moves[event.key]);
    else if (/^[0-9]$/.test(event.key)) typeDigit(event.key);
    else if (event.key === 'Enter') commitPending();
    else if (event.key === 'Backspace' || event.key === 'Delete') erase();
    else if (event.key === 'z' || event.key === 'Z') undo();
    else return;
    event.preventDefault();
});

document.getElementById('undoBtn').onclick = undo;
document.getElementById('clearBtn').onclick = () => {
    dropPending();
    if (solved) return;
    const cleared = ChainEngine.start(puzzle);
    if (cleared.every((v, i) => v === values[i])) return;
    history.push([...values]);
    const before = values;
    values = cleared;
    paintChanges(before);
    afterChange(true);
};
document.getElementById('restartBtn').onclick = () => loadLevel(currentLevelIdx);

function nextLevel() {
    if (currentLevelIdx + 1 < LevelRegistry.length) loadLevel(currentLevelIdx + 1);
    else setStatus('all_levels_cleared');
}

/* ---------- Status ---------- */

function setStatus(key, params = {}) {
    statusKey = key;
    statusParams = params;
    statusEl.innerText = i18n.t(key, params);
}

function updateLevelInfo() {
    const level = LevelRegistry[currentLevelIdx];
    levelInfoEl.innerText = `${i18n.t('level')} ${currentLevelIdx + 1}/${LevelRegistry.length}: ${level.name}`;
    updateMode();
}

window.addEventListener('langChanged', () => {
    setStatus(statusKey, statusParams);
    updateLevelInfo();
    render();
});

if (LevelRegistry.length > 0) loadLevel(Progress.startLevel());
