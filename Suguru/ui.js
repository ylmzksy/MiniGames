/**
 * Suguru page: tap a cell to select it, then tap a digit on the pad.
 * Keyboard: arrows move the selection, 1-5 enter a digit, 0 / Backspace /
 * Delete clear the cell, Z undoes.
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
const padButtons = [...document.querySelectorAll('#pad button')];

function loadLevel(idx) {
    const level = LevelRegistry[idx];
    if (!level) return;
    currentLevelIdx = idx;
    Progress.setCurrent(idx);
    puzzle = SuguruEngine.parse(level);
    values = puzzle.givens.map(row => [...row]);
    history = [];
    solved = false;
    cursor = firstOpenCell();
    clearInterval(timer);
    timer = null;
    elapsed = 0;
    setStatus('status_play');
    updateLevelInfo();
    buildBoard();
    render();
}

const isGiven = (x, y) => puzzle.givens[y][x] !== null;

function firstOpenCell() {
    for (let y = 0; y < puzzle.height; y++) {
        for (let x = 0; x < puzzle.width; x++) if (!isGiven(x, y)) return [x, y];
    }
    return [0, 0];
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

// The cells are built once per level; after that only what changed is touched
let cellEls = [];

function buildBoard() {
    const { width, height, region } = puzzle;
    board.style.gridTemplateColumns = `repeat(${width}, 1fr)`;
    board.style.maxWidth = `${width * 58}px`;
    board.innerHTML = '';
    cellEls = [];
    for (let y = 0; y < height; y++) {
        const row = [];
        for (let x = 0; x < width; x++) {
            const id = region[y][x];
            const cell = document.createElement('div');
            const edges = [
                y === 0 || region[y - 1][x] !== id ? 'bt' : '',
                x === width - 1 || region[y][x + 1] !== id ? 'br' : '',
                y === height - 1 || region[y + 1][x] !== id ? 'bb' : '',
                x === 0 || region[y][x - 1] !== id ? 'bl' : ''
            ];
            cell.className = ['cell', `tint${puzzle.colors[id]}`, isGiven(x, y) ? 'given' : '', ...edges].join(' ').replace(/\s+/g, ' ');
            cell.dataset.x = x;
            cell.dataset.y = y;
            cell.textContent = values[y][x] ?? '';
            board.appendChild(cell);
            row.push(cell);
        }
        cellEls.push(row);
    }
}

function paintCell(x, y) {
    cellEls[y][x].textContent = values[y][x] ?? '';
}

function paintChanges(before) {
    before.forEach((row, y) => row.forEach((v, x) => { if (v !== values[y][x]) paintCell(x, y); }));
}

// Conflicts, selection and the solved look are class toggles, so nothing else is redrawn
function render() {
    const { bad } = SuguruEngine.check(puzzle, values);
    const [cx, cy] = cursor;
    const selRegion = puzzle.region[cy][cx];
    cellEls.forEach((row, y) => row.forEach((cell, x) => {
        cell.classList.toggle('bad', bad.has(`${x},${y}`));
        cell.classList.toggle('cursor', cx === x && cy === y);
        cell.classList.toggle('same-region', !solved && puzzle.region[y][x] === selRegion);
    }));
    board.classList.toggle('solved', solved);
    renderPad();
    document.getElementById('undoBtn').disabled = solved || !history.length;
    renderCounters();
}

// Digits larger than the selected cell's region are greyed out
function renderPad() {
    const [x, y] = cursor;
    const locked = solved || isGiven(x, y);
    const size = SuguruEngine.sizeAt(puzzle, x, y);
    padButtons.forEach(btn => {
        const d = Number(btn.dataset.digit);
        btn.disabled = locked || d > size;
    });
}

function renderCounters() {
    const empty = values.flat().filter(v => v === null).length;
    countersEl.innerText = `${i18n.t('empty')}: ${empty} · ${formatTime(elapsed)}`;
}

/* ---------- Playing ---------- */

function setCell(x, y, v) {
    if (solved || isGiven(x, y) || values[y][x] === v) return;
    if (v !== null && v > SuguruEngine.sizeAt(puzzle, x, y)) return;
    history.push(values.map(row => [...row]));
    values[y][x] = v;
    paintCell(x, y);
    startTimer();
    afterChange();
}

function afterChange() {
    const result = SuguruEngine.check(puzzle, values);
    if (result.full && !result.bad.size) {
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
    if (result.bad.size) setStatus('status_conflict');
    else if (result.full) setStatus('status_check');
    else setStatus('status_play');
    render();
}

board.addEventListener('click', (e) => {
    const cell = e.target.closest('.cell');
    if (!cell || solved) return;
    cursor = [Number(cell.dataset.x), Number(cell.dataset.y)];
    render();
});

document.getElementById('pad').addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn || btn.disabled) return;
    const d = Number(btn.dataset.digit);
    setCell(cursor[0], cursor[1], d === 0 ? null : d);
});

function undo() {
    if (solved || !history.length) return;
    const before = values;
    values = history.pop();
    paintChanges(before);
    afterChange();
}

document.addEventListener('keydown', (event) => {
    const inFormControl = event.target instanceof Element && event.target.closest('select, input');
    if (inFormControl || document.querySelector('.modal.active') || !puzzle) return;
    const moves = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
    const [x, y] = cursor;
    if (moves[event.key]) {
        const [dx, dy] = moves[event.key];
        cursor = [Math.min(puzzle.width - 1, Math.max(0, x + dx)), Math.min(puzzle.height - 1, Math.max(0, y + dy))];
        render();
    } else if (/^[1-9]$/.test(event.key)) setCell(x, y, Number(event.key));
    else if (event.key === '0' || event.key === 'Backspace' || event.key === 'Delete') setCell(x, y, null);
    else if (event.key === 'z' || event.key === 'Z') undo();
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
    levelInfoEl.innerText = `${i18n.t('level')} ${currentLevelIdx + 1}/${LevelRegistry.length}: ${level.name} (${puzzle.width}×${puzzle.height})`;
}

window.addEventListener('langChanged', () => {
    setStatus(statusKey, statusParams);
    updateLevelInfo();
    render();
});

if (LevelRegistry.length > 0) loadLevel(Progress.startLevel());
