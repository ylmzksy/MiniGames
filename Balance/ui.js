/**
 * Balance page: tap a cell to cycle empty → circle → square → empty.
 * Keyboard: arrows move the cursor, 1 / 2 place a circle / square, 0 or
 * Backspace clears, Space cycles, Z undoes.
 */
let currentLevelIdx = 0;
let puzzle = null;
let values = [];
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
    puzzle = BalanceEngine.parse(level);
    values = puzzle.givens.map(row => [...row]);
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

const isGiven = (x, y) => puzzle.givens[y][x] !== null;

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

function symbol(v) {
    if (v === 0) return '<span class="sym circle"></span>';
    if (v === 1) return '<span class="sym square"></span>';
    return '';
}

// The cells and signs are built once per level; after that only what changed is touched
let cellEls = [];
let signEls = [];

function buildBoard() {
    const size = puzzle.size;
    board.style.gridTemplateColumns = `repeat(${size}, 1fr)`;
    board.innerHTML = '';
    cellEls = [];
    for (let y = 0; y < size; y++) {
        const row = [];
        for (let x = 0; x < size; x++) {
            const cell = document.createElement('div');
            cell.className = `cell ${isGiven(x, y) ? 'given' : ''}`;
            cell.dataset.x = x;
            cell.dataset.y = y;
            // The symbol lives in its own holder, so the signs on the cell's edges are never rebuilt
            cell.innerHTML = `<span class="holder">${symbol(values[y][x])}</span>`;
            board.appendChild(cell);
            row.push(cell);
        }
        cellEls.push(row);
    }
    signEls = puzzle.signs.map(sign => {
        const el = document.createElement('span');
        el.className = `sign ${sign.side}`;
        el.textContent = sign.kind === '=' ? '=' : '×';
        cellEls[sign.a[1]][sign.a[0]].appendChild(el);
        return el;
    });
}

// Redraws the symbol of one cell
function paintCell(x, y) {
    cellEls[y][x].firstElementChild.innerHTML = symbol(values[y][x]);
}

// Redraws only the cells whose value differs from `before`
function paintChanges(before) {
    before.forEach((row, y) => row.forEach((v, x) => { if (v !== values[y][x]) paintCell(x, y); }));
}

// Error marks, cursor and the solved look are class toggles, so nothing else is redrawn
function render() {
    const { badCells, badSigns } = BalanceEngine.check(puzzle, values);
    cellEls.forEach((row, y) => row.forEach((cell, x) => {
        cell.classList.toggle('bad', badCells.has(`${x},${y}`));
        cell.classList.toggle('cursor', cursor[0] === x && cursor[1] === y);
    }));
    signEls.forEach((el, i) => el.classList.toggle('bad', badSigns.has(i)));
    board.classList.toggle('solved', solved);
    document.getElementById('undoBtn').disabled = solved || !history.length;
    renderCounters();
}

function renderCounters() {
    const empty = values.flat().filter(v => v === null).length;
    countersEl.innerText = `${i18n.t('empty')}: ${empty} · ${formatTime(elapsed)}`;
}

/* ---------- Playing ---------- */

function setCell(x, y, v) {
    if (solved || isGiven(x, y) || values[y][x] === v) return;
    history.push(values.map(row => [...row]));
    values[y][x] = v;
    paintCell(x, y);
    startTimer();
    afterChange();
}

function afterChange() {
    const result = BalanceEngine.check(puzzle, values);
    if (BalanceEngine.isSolved(puzzle, values)) {
        solved = true;
        clearInterval(timer);
        timer = null;
        setStatus('status_solved', { time: formatTime(elapsed) });
        Progress.markSolved(currentLevelIdx);
        render();
        const id = currentLevelIdx;
        setTimeout(() => { if (id === currentLevelIdx) nextLevel(); }, 2200);
        return;
    }
    if (result.badCells.size || result.badSigns.size) setStatus('status_conflict');
    else if (result.full) setStatus('status_check');
    else setStatus('status_play');
    render();
}

function cycle(x, y) {
    const v = values[y][x];
    setCell(x, y, v === null ? 0 : v === 0 ? 1 : null);
}

board.addEventListener('click', (e) => {
    const cell = e.target.closest('.cell');
    if (!cell) return;
    const x = Number(cell.dataset.x);
    const y = Number(cell.dataset.y);
    cursor = [x, y];
    if (isGiven(x, y)) {
        render();
        return;
    }
    cycle(x, y);
});

function undo() {
    if (solved || !history.length) return;
    const before = values;
    values = history.pop();
    paintChanges(before);
    afterChange();
}

document.addEventListener('keydown', (event) => {
    const inFormControl = event.target instanceof Element && event.target.closest('select, input, button');
    if (inFormControl || document.querySelector('.modal.active') || !puzzle) return;
    const moves = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
    const [x, y] = cursor;
    if (moves[event.key]) {
        const [dx, dy] = moves[event.key];
        cursor = [Math.min(puzzle.size - 1, Math.max(0, x + dx)), Math.min(puzzle.size - 1, Math.max(0, y + dy))];
        render();
    } else if (event.key === '1') setCell(x, y, 0);
    else if (event.key === '2') setCell(x, y, 1);
    else if (event.key === '0' || event.key === 'Backspace' || event.key === 'Delete') setCell(x, y, null);
    else if (event.key === ' ') { if (!isGiven(x, y)) cycle(x, y); }
    else if (event.key === 'z') undo();
    else return;
    event.preventDefault();
});

document.getElementById('undoBtn').onclick = undo;
document.getElementById('clearBtn').onclick = () => {
    if (solved) return;
    const cleared = puzzle.givens.map(row => [...row]);
    if (cleared.every((row, y) => row.every((v, x) => v === values[y][x]))) return;
    history.push(values.map(row => [...row]));
    const before = values;
    values = cleared;
    paintChanges(before);
    afterChange();
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
    render();
});

if (LevelRegistry.length > 0) loadLevel(Progress.startLevel());
