/**
 * Magic Square page: tap a cell to select it, then tap a number on the pad
 * (numbers already on the board are disabled). Keyboard: arrows move, digits
 * type a number (two quick digits make a two-digit number, e.g. 1 then 6 = 16),
 * 0 / Backspace / Delete clear the cell, Z undoes.
 */
const TWO_DIGIT_MS = 1200; // time to type the second digit of a number

let currentLevelIdx = 0;
let puzzle = null;
let values = [];
let history = [];
let solved = false;
let cursor = [0, 0];
let typed = null; // { x, y, first, at }: a first digit that a second may extend
let statusKey = 'status_play';
let statusParams = {};
let startTime = 0;
let elapsed = 0;
let timer = null;

const board = document.getElementById('game-board');
const statusEl = document.getElementById('status');
const levelInfoEl = document.getElementById('level-info');
const targetEl = document.getElementById('target');
const countersEl = document.getElementById('counters');
const padEl = document.getElementById('pad');

function loadLevel(idx) {
    const level = LevelRegistry[idx];
    if (!level) return;
    currentLevelIdx = idx;
    Progress.setCurrent(idx);
    puzzle = MagicEngine.parse(level);
    values = puzzle.givens.map(row => [...row]);
    history = [];
    solved = false;
    typed = null;
    cursor = firstOpenCell();
    clearInterval(timer);
    timer = null;
    elapsed = 0;
    setStatus('status_play');
    updateLevelInfo();
    buildBoard();
    buildPad();
    render();
}

const isGiven = (x, y) => puzzle.givens[y][x] !== null;

function firstOpenCell() {
    for (let y = 0; y < puzzle.size; y++) {
        for (let x = 0; x < puzzle.size; x++) if (!isGiven(x, y)) return [x, y];
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

/* ---------- Building (once per level) ---------- */

let cellEls = [];
let sumEls = []; // one label per line, in the order of puzzle.lines
let padButtons = [];

function makeSum(line) {
    const el = document.createElement('div');
    el.className = `sum ${line.kind}`;
    return el;
}

// Layout: a thin top row holding the anti-diagonal sum at the top right, the
// grid with each row's sum on its right, and a bottom row with the column sums
// and the main diagonal's sum in the corner.
function buildBoard() {
    const n = puzzle.size;
    board.style.gridTemplateColumns = `repeat(${n}, minmax(0, 1fr)) minmax(0, 0.8fr)`;
    board.style.maxWidth = `${n * 76 + 60}px`;
    board.dataset.size = n;
    board.innerHTML = '';
    cellEls = [];
    sumEls = puzzle.lines.map(makeSum);
    const lineIdx = (kind, index) => puzzle.lines.findIndex(l => l.kind === kind && l.index === index);
    const spacer = () => { const s = document.createElement('div'); s.className = 'spacer'; return s; };

    for (let x = 0; x < n; x++) board.appendChild(spacer());
    board.appendChild(sumEls[lineIdx('anti', 0)]);
    for (let y = 0; y < n; y++) {
        const row = [];
        for (let x = 0; x < n; x++) {
            const cell = document.createElement('div');
            cell.className = `cell ${isGiven(x, y) ? 'given' : ''}`;
            cell.dataset.x = x;
            cell.dataset.y = y;
            cell.textContent = values[y][x] ?? '';
            board.appendChild(cell);
            row.push(cell);
        }
        cellEls.push(row);
        board.appendChild(sumEls[lineIdx('row', y)]);
    }
    for (let x = 0; x < n; x++) board.appendChild(sumEls[lineIdx('col', x)]);
    board.appendChild(sumEls[lineIdx('diag', 0)]);
}

function buildPad() {
    const total = puzzle.total;
    padEl.style.gridTemplateColumns = `repeat(${{ 3: 5, 4: 6, 5: 7 }[puzzle.size] || 7}, 1fr)`;
    padEl.innerHTML = '';
    padButtons = [];
    for (let v = 1; v <= total; v++) {
        const btn = document.createElement('button');
        btn.textContent = v;
        btn.dataset.value = v;
        padEl.appendChild(btn);
        padButtons.push(btn);
    }
    const erase = document.createElement('button');
    erase.className = 'erase';
    erase.dataset.value = 0;
    erase.dataset.i18n = 'erase';
    erase.textContent = i18n.t('erase');
    padEl.appendChild(erase);
    padButtons.push(erase);
}

/* ---------- Updating ---------- */

function paintCell(x, y) {
    cellEls[y][x].textContent = values[y][x] ?? '';
}

function paintChanges(before) {
    before.forEach((row, y) => row.forEach((v, x) => { if (v !== values[y][x]) paintCell(x, y); }));
}

// Everything else is class toggles and the sum labels' text
function render() {
    const { dup, lines } = MagicEngine.check(puzzle, values);
    const [cx, cy] = cursor;
    cellEls.forEach((row, y) => row.forEach((cell, x) => {
        cell.classList.toggle('bad', dup.has(`${x},${y}`));
        cell.classList.toggle('cursor', !solved && cx === x && cy === y);
    }));
    puzzle.lines.forEach((line, i) => {
        const el = sumEls[i];
        const { sum, filled, state } = lines[i];
        const arrow = line.kind === 'diag' ? '↘ ' : line.kind === 'anti' ? '↙ ' : '';
        const text = filled ? `${arrow}${sum}` : arrow.trim();
        if (el.textContent !== text) el.textContent = text;
        el.classList.toggle('ok', state === 'ok');
        el.classList.toggle('bad', state === 'bad');
        el.classList.toggle('active', !solved && line.cells.some(([x, y]) => x === cx && y === cy));
    });
    board.classList.toggle('solved', solved);
    renderPad();
    document.getElementById('undoBtn').disabled = solved || !history.length;
    renderCounters();
}

function renderPad() {
    const used = new Set(values.flat().filter(v => v !== null));
    const [x, y] = cursor;
    const locked = solved || isGiven(x, y);
    padButtons.forEach(btn => {
        const v = Number(btn.dataset.value);
        btn.disabled = locked || (v ? used.has(v) : values[y][x] === null);
    });
}

function renderCounters() {
    const empty = values.flat().filter(v => v === null).length;
    countersEl.innerText = `${i18n.t('empty')}: ${empty} · ${formatTime(elapsed)}`;
}

/* ---------- Playing ---------- */

// record = false changes the cell without a new undo step (the second digit of a number)
function setCell(x, y, v, record = true) {
    if (solved || isGiven(x, y) || values[y][x] === v) return;
    if (v !== null && (v < 1 || v > puzzle.total)) return;
    if (record) history.push(values.map(row => [...row]));
    values[y][x] = v;
    paintCell(x, y);
    startTimer();
    afterChange();
}

function afterChange() {
    const result = MagicEngine.check(puzzle, values);
    if (MagicEngine.isSolved(puzzle, values)) {
        solved = true;
        typed = null;
        clearInterval(timer);
        timer = null;
        setStatus('status_solved', { time: formatTime(elapsed) });
        Progress.markSolved(currentLevelIdx);
        render();
        const id = currentLevelIdx;
        setTimeout(() => { if (id === currentLevelIdx) nextLevel(); }, 2200);
        return;
    }
    if (result.dup.size || result.lines.some(l => l.state === 'bad')) setStatus('status_conflict');
    else if (result.full) setStatus('status_check');
    else setStatus('status_play');
    render();
}

function select(x, y) {
    cursor = [x, y];
    typed = null;
    render();
}

board.addEventListener('click', (e) => {
    const cell = e.target.closest('.cell');
    if (!cell || solved) return;
    select(Number(cell.dataset.x), Number(cell.dataset.y));
});

padEl.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn || btn.disabled) return;
    typed = null;
    const v = Number(btn.dataset.value);
    setCell(cursor[0], cursor[1], v || null);
});

// A digit either completes a two-digit number started a moment ago, or starts a new one
function typeDigit(d) {
    const [x, y] = cursor;
    if (solved || isGiven(x, y)) return;
    const now = Date.now();
    const first = typed;
    typed = null;
    if (first && first.x === x && first.y === y && now - first.at < TWO_DIGIT_MS && first.first * 10 + d <= puzzle.total) {
        // The first digit already made an undo step, unless it changed nothing
        setCell(x, y, first.first * 10 + d, !first.recorded);
        return;
    }
    if (d === 0) { setCell(x, y, null); return; }
    const steps = history.length;
    setCell(x, y, d);
    if (d * 10 <= puzzle.total) typed = { x, y, first: d, at: now, recorded: history.length > steps };
}

function undo() {
    if (solved || !history.length) return;
    typed = null;
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
    const n = puzzle.size;
    if (moves[event.key]) {
        const [dx, dy] = moves[event.key];
        if (!solved) select(Math.min(n - 1, Math.max(0, x + dx)), Math.min(n - 1, Math.max(0, y + dy)));
    } else if (/^[0-9]$/.test(event.key)) typeDigit(Number(event.key));
    else if (event.key === 'Backspace' || event.key === 'Delete') { typed = null; setCell(x, y, null); }
    else if (event.key === 'z' || event.key === 'Z') undo();
    else return;
    event.preventDefault();
});

document.getElementById('undoBtn').onclick = undo;
document.getElementById('clearBtn').onclick = () => {
    if (solved) return;
    typed = null;
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
    const n = puzzle.size;
    levelInfoEl.innerText = `${i18n.t('level')} ${currentLevelIdx + 1}/${LevelRegistry.length}: ${level.name} (${n}×${n})`;
    targetEl.innerHTML = `${i18n.t('magic_sum')}: <strong>${puzzle.magic}</strong> · ${i18n.t('numbers_range', { max: puzzle.total })}`;
}

window.addEventListener('langChanged', () => {
    setStatus(statusKey, statusParams);
    updateLevelInfo();
    render();
});

if (LevelRegistry.length > 0) loadLevel(Progress.startLevel());
