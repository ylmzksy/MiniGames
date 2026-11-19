/**
 * Strike Sums page: tap a number to cycle neutral → crossed out → kept → neutral.
 * Keyboard: arrows move the cursor, Space / Enter cycles, 1 or X crosses out, 2 or O keeps,
 * 0 or Backspace makes it neutral, Z undoes.
 */
let currentLevelIdx = 0;
let puzzle = null;
let marks = [];
let history = [];
let solved = false;
let cursor = [0, 0];
let statusKey = 'status_play';
let statusParams = {};
let startTime = 0;
let elapsed = 0;
let timer = null;

const board = document.getElementById('game-board');
const statusEl = document.getElementById('status');
const levelInfoEl = document.getElementById('level-info');
const countersEl = document.getElementById('counters');

function loadLevel(idx) {
    const level = LevelRegistry[idx];
    if (!level) return;
    currentLevelIdx = idx;
    Progress.setCurrent(idx);
    puzzle = StrikeEngine.parse(level);
    marks = Array.from({ length: puzzle.size }, () => Array(puzzle.size).fill(NEUTRAL));
    history = [];
    solved = false;
    cursor = [0, 0];
    clearInterval(timer);
    timer = null;
    elapsed = 0;
    setStatus('status_play');
    updateLevelInfo();
    buildBoard();
    render();
}

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

/* ---------- Rendering ---------- */

// Built once per level; afterwards only the changed cell and its two clues are touched
let cellEls = [];
let rowClueEls = [];
let colClueEls = [];
let cursorEl = null;

// Negative numbers get a real minus sign
const formatNum = v => (v < 0 ? `−${-v}` : String(v));

function makeEl(cls, html = '') {
    const el = document.createElement('div');
    el.className = cls;
    el.innerHTML = html;
    board.appendChild(el);
    return el;
}

function makeClue(cls, clue) {
    return makeEl(`clue ${cls}`, `<span class="clue-num">${formatNum(clue)}</span><span class="clue-sum"></span>`);
}

function buildBoard() {
    const n = puzzle.size;
    board.style.setProperty('--n', n);
    board.style.gridTemplateColumns = `repeat(${n + 1}, minmax(0, 1fr))`;
    board.innerHTML = '';
    cellEls = [];
    cursorEl = null;
    rowClueEls = [];
    for (let y = 0; y < n; y++) {
        const row = [];
        for (let x = 0; x < n; x++) {
            const cell = makeEl('cell', `<span class="num">${formatNum(puzzle.grid[y][x])}</span>`);
            cell.dataset.x = x;
            cell.dataset.y = y;
            row.push(cell);
        }
        cellEls.push(row);
        rowClueEls.push(makeClue('row-clue', puzzle.rows[y]));
    }
    colClueEls = puzzle.cols.map(c => makeClue('col-clue', c));
    makeEl('corner');
}

function paintCell(x, y) {
    const cell = cellEls[y][x];
    cell.classList.toggle('crossed', marks[y][x] === CROSSED);
    cell.classList.toggle('kept', marks[y][x] === KEPT);
}

function paintClue(el, { sum, state }) {
    const sumEl = el.lastElementChild;
    const text = formatNum(sum);
    if (sumEl.textContent !== text) sumEl.textContent = text;
    el.classList.toggle('ok', state === 'ok');
    el.classList.toggle('bad', state === 'bad');
}

function paintLines(rows, cols) {
    rows.forEach(y => paintClue(rowClueEls[y], StrikeEngine.lineState(puzzle, marks, 'row', y)));
    cols.forEach(x => paintClue(colClueEls[x], StrikeEngine.lineState(puzzle, marks, 'col', x)));
}

const allLines = () => [...Array(puzzle.size).keys()];

function paintCursor() {
    const el = cellEls[cursor[1]][cursor[0]];
    if (el === cursorEl) return;
    if (cursorEl) cursorEl.classList.remove('cursor');
    el.classList.add('cursor');
    cursorEl = el;
}

function render() {
    paintLines(allLines(), allLines());
    paintCursor();
    board.classList.toggle('solved', solved);
    document.getElementById('undoBtn').disabled = solved || !history.length;
    renderCounters();
}

function renderCounters() {
    const crossed = marks.flat().filter(v => v === CROSSED).length;
    countersEl.innerText = `${i18n.t('crossed')}: ${crossed} · ${formatTime(elapsed)}`;
}

/* ---------- Playing ---------- */

function setCell(x, y, v) {
    if (solved || marks[y][x] === v) return;
    history.push(marks.map(row => [...row]));
    marks[y][x] = v;
    paintCell(x, y);
    paintLines([y], [x]);
    startTimer();
    afterChange();
}

function afterChange() {
    document.getElementById('undoBtn').disabled = !history.length;
    renderCounters();
    const { rows, cols } = StrikeEngine.check(puzzle, marks);
    if (rows.every(l => l.state === 'ok') && cols.every(l => l.state === 'ok')) {
        solved = true;
        clearInterval(timer);
        timer = null;
        setStatus('status_solved', { time: formatTime(elapsed) });
        Progress.markSolved(currentLevelIdx);
        board.classList.add('solved');
        document.getElementById('undoBtn').disabled = true;
        const id = currentLevelIdx;
        setTimeout(() => { if (id === currentLevelIdx) nextLevel(); }, 2200);
        return;
    }
    setStatus([...rows, ...cols].some(l => l.state === 'bad') ? 'status_over' : 'status_play');
}

function cycle(x, y) {
    setCell(x, y, (marks[y][x] + 1) % 3);
}

board.addEventListener('click', (e) => {
    const cell = e.target.closest('.cell');
    if (!cell) return;
    const x = Number(cell.dataset.x);
    const y = Number(cell.dataset.y);
    cursor = [x, y];
    paintCursor();
    cycle(x, y);
});

// Repaints the cells that differ from `before`, then every clue
function restore(next) {
    const before = marks;
    marks = next;
    before.forEach((row, y) => row.forEach((v, x) => { if (v !== marks[y][x]) paintCell(x, y); }));
    paintLines(allLines(), allLines());
    afterChange();
}

function undo() {
    if (solved || !history.length) return;
    restore(history.pop());
}

document.addEventListener('keydown', (event) => {
    const inFormControl = event.target instanceof Element && event.target.closest('select, input, button');
    if (inFormControl || document.querySelector('.modal.active') || !puzzle) return;
    const moves = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
    const [x, y] = cursor;
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    if (moves[key]) {
        const [dx, dy] = moves[key];
        cursor = [Math.min(puzzle.size - 1, Math.max(0, x + dx)), Math.min(puzzle.size - 1, Math.max(0, y + dy))];
        paintCursor();
    } else if (key === ' ' || key === 'Enter') cycle(x, y);
    else if (key === '1' || key === 'x') setCell(x, y, CROSSED);
    else if (key === '2' || key === 'o') setCell(x, y, KEPT);
    else if (key === '0' || key === 'Backspace' || key === 'Delete') setCell(x, y, NEUTRAL);
    else if (key === 'z') undo();
    else return;
    event.preventDefault();
});

document.getElementById('undoBtn').onclick = undo;
document.getElementById('clearBtn').onclick = () => {
    if (solved || marks.every(row => row.every(v => v === NEUTRAL))) return;
    history.push(marks.map(row => [...row]));
    restore(marks.map(row => row.map(() => NEUTRAL)));
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
}

window.addEventListener('langChanged', () => {
    setStatus(statusKey, statusParams);
    updateLevelInfo();
    renderCounters();
});

if (LevelRegistry.length > 0) loadLevel(Progress.startLevel());
