/**
 * Product Rooms page: tap a cell to select it, then a digit on the pad.
 * Keyboard: arrows move, digits enter, 0 / Backspace / Delete clear, N toggles notes, Z undoes.
 * The board is built once per level; after that only changed cells and classes are touched.
 */
let currentLevelIdx = 0;
let puzzle = null;
let values = [];     // values[r][c]: entered digit, 0 = empty
let notes = [];      // notes[r][c]: bitmask of pencil marks (bit d = digit d)
let history = [];    // snapshots of { values, notes } before each change
let selected = [0, 0];
let notesMode = false;
let solved = false;
let statusKey = 'status_play';
let statusParams = {};
let startTime = 0;
let elapsed = 0;
let timer = null;

const board = document.getElementById('game-board');
const padEl = document.getElementById('pad');
const statusEl = document.getElementById('status');
const levelInfoEl = document.getElementById('level-info');
const countersEl = document.getElementById('counters');
const notesBtn = document.getElementById('notesBtn');

function loadLevel(idx) {
    const level = LevelRegistry[idx];
    if (!level) return;
    currentLevelIdx = idx;
    Progress.setCurrent(idx);
    puzzle = InshiEngine.parse(level);
    const n = puzzle.size;
    values = Array.from({ length: n }, () => Array(n).fill(0));
    notes = Array.from({ length: n }, () => Array(n).fill(0));
    history = [];
    selected = [0, 0];
    solved = false;
    clearInterval(timer);
    timer = null;
    elapsed = 0;
    setStatus('status_play');
    updateLevelInfo();
    buildPad();
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

/* ---------- Building ---------- */

let cellEls = [];
let labelEls = [];

function buildPad() {
    const n = puzzle.size;
    // Digits plus Erase on one row when they fit, otherwise on two
    padEl.style.gridTemplateColumns = `repeat(${n + 1 <= 5 ? n + 1 : Math.ceil((n + 1) / 2)}, 1fr)`;
    padEl.innerHTML = '';
    for (let d = 1; d <= n; d++) {
        const btn = document.createElement('button');
        btn.textContent = d;
        btn.dataset.digit = d;
        padEl.appendChild(btn);
    }
    const erase = document.createElement('button');
    erase.dataset.digit = 0;
    erase.dataset.i18n = 'erase';
    erase.textContent = i18n.t('erase');
    padEl.appendChild(erase);
}

function buildBoard() {
    const n = puzzle.size;
    board.style.gridTemplateColumns = `repeat(${n}, 1fr)`;
    board.className = `board size-${n}`;
    board.innerHTML = '';
    cellEls = [];
    labelEls = [];
    const sameRoom = (r, c, rr, cc) =>
        rr >= 0 && cc >= 0 && rr < n && cc < n && puzzle.roomOf[rr][cc] === puzzle.roomOf[r][c];
    for (let r = 0; r < n; r++) {
        const row = [];
        for (let c = 0; c < n; c++) {
            const roomIdx = puzzle.roomOf[r][c];
            const cell = document.createElement('div');
            const classes = ['cell', `tint-${puzzle.tints[roomIdx]}`];
            // Thick walls on the sides that border another room
            [['top', -1, 0], ['bottom', 1, 0], ['left', 0, -1], ['right', 0, 1]].forEach(([side, dr, dc]) => {
                if (!sameRoom(r, c, r + dr, c + dc)) classes.push(`wall-${side}`);
            });
            cell.className = classes.join(' ');
            cell.dataset.r = r;
            cell.dataset.c = c;

            const [lr, lc] = puzzle.rooms[roomIdx].label;
            if (lr === r && lc === c) {
                const label = document.createElement('span');
                label.className = 'product';
                label.textContent = puzzle.rooms[roomIdx].product;
                cell.appendChild(label);
                labelEls[roomIdx] = label;
            }
            const content = document.createElement('div');
            content.className = 'content';
            cell.appendChild(content);
            board.appendChild(cell);
            row.push(cell);
        }
        cellEls.push(row);
    }
}

/* ---------- Rendering ---------- */

// Redraws the digit or pencil marks of one cell
function paintCell(r, c) {
    const content = cellEls[r][c].lastElementChild;
    const v = values[r][c];
    if (v) {
        content.innerHTML = `<span class="value">${v}</span>`;
    } else if (notes[r][c]) {
        content.innerHTML = `<div class="notes">${Array.from({ length: puzzle.size }, (_, i) =>
            `<span>${notes[r][c] >> (i + 1) & 1 ? i + 1 : ''}</span>`).join('')}</div>`;
    } else {
        content.innerHTML = '';
    }
}

function paintChanges(before) {
    before.values.forEach((row, r) => row.forEach((v, c) => {
        if (v !== values[r][c] || before.notes[r][c] !== notes[r][c]) paintCell(r, c);
    }));
}

// Selection, highlights, conflicts and the solved look are class toggles only
function render() {
    const { cells, roomState } = InshiEngine.check(puzzle, values);
    const [sr, sc] = selected;
    const sRoom = puzzle.roomOf[sr][sc];
    const sValue = values[sr][sc];
    cellEls.forEach((row, r) => row.forEach((cell, c) => {
        const isSel = r === sr && c === sc;
        cell.classList.toggle('selected', isSel && !solved);
        cell.classList.toggle('peer', !isSel && !solved && (r === sr || c === sc));
        cell.classList.toggle('in-room', !isSel && !solved && puzzle.roomOf[r][c] === sRoom);
        cell.classList.toggle('same', !isSel && !solved && sValue > 0 && values[r][c] === sValue);
        cell.classList.toggle('conflict', cells.has(`${r},${c}`));
    }));
    labelEls.forEach((label, i) => {
        label.classList.toggle('bad', roomState[i] === 'bad');
        label.classList.toggle('ok', roomState[i] === 'ok');
    });
    board.classList.toggle('solved', solved);
    document.getElementById('undoBtn').disabled = solved || !history.length;
    renderCounters();
}

function renderCounters() {
    const empty = values.flat().filter(v => !v).length;
    countersEl.innerText = `${i18n.t('empty')}: ${empty} · ${formatTime(elapsed)}`;
}

/* ---------- Playing ---------- */

function snapshot() {
    return { values: values.map(row => [...row]), notes: notes.map(row => [...row]) };
}

window.selectCell = (r, c) => {
    if (solved) return;
    selected = [r, c];
    render();
};

window.enterDigit = (d) => {
    if (solved || !puzzle || d < 1 || d > puzzle.size) return;
    const [r, c] = selected;
    const before = snapshot();
    if (notesMode) {
        if (values[r][c]) return;
        notes[r][c] ^= 1 << d;
    } else {
        // Typing the same digit again clears the cell
        values[r][c] = values[r][c] === d ? 0 : d;
        if (values[r][c]) {
            // A placed digit is no longer a candidate for the cell, its row or its column
            notes[r][c] = 0;
            InshiEngine.peers(puzzle, r, c).forEach(([pr, pc]) => { notes[pr][pc] &= ~(1 << d); });
        }
    }
    history.push(before);
    paintChanges(before);
    startTimer();
    afterChange();
};

window.eraseCell = () => {
    if (solved || !puzzle) return;
    const [r, c] = selected;
    if (!values[r][c] && !notes[r][c]) return;
    const before = snapshot();
    values[r][c] = 0;
    notes[r][c] = 0;
    history.push(before);
    paintCell(r, c);
    afterChange();
};

window.toggleNotes = () => {
    notesMode = !notesMode;
    notesBtn.classList.toggle('primary', notesMode);
};

function undo() {
    if (solved || !history.length) return;
    const now = snapshot();
    const prev = history.pop();
    values = prev.values;
    notes = prev.notes;
    paintChanges(now);
    afterChange();
}

function clearBoard() {
    if (solved) return;
    if (values.every(row => row.every(v => !v)) && notes.every(row => row.every(m => !m))) return;
    const before = snapshot();
    history.push(before);
    values = values.map(row => row.map(() => 0));
    notes = notes.map(row => row.map(() => 0));
    paintChanges(before);
    afterChange();
}

function afterChange() {
    if (InshiEngine.isSolved(puzzle, values)) {
        solved = true;
        clearInterval(timer);
        timer = null;
        setStatus('status_solved', { time: formatTime(elapsed) });
        Progress.markSolved(currentLevelIdx);
        render();
        const id = currentLevelIdx;
        setTimeout(() => { if (id === currentLevelIdx && solved) nextLevel(); }, 2000);
        return;
    }
    const { cells } = InshiEngine.check(puzzle, values);
    if (cells.size) setStatus('status_conflict');
    else if (values.every(row => row.every(Boolean))) setStatus('status_check');
    else setStatus('status_play');
    render();
}

function moveSelection(dr, dc) {
    const n = puzzle.size;
    selectCell(Math.min(n - 1, Math.max(0, selected[0] + dr)), Math.min(n - 1, Math.max(0, selected[1] + dc)));
}

function nextLevel() {
    if (currentLevelIdx + 1 < LevelRegistry.length) loadLevel(currentLevelIdx + 1);
    else setStatus('all_levels_cleared');
}

/* ---------- Input ---------- */

board.addEventListener('click', (e) => {
    const cell = e.target.closest('.cell');
    if (cell) selectCell(Number(cell.dataset.r), Number(cell.dataset.c));
});

padEl.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const d = Number(btn.dataset.digit);
    if (d) enterDigit(d);
    else eraseCell();
});

document.addEventListener('keydown', (event) => {
    const inFormControl = event.target instanceof Element && event.target.closest('select, input');
    if (inFormControl || document.querySelector('.modal.active') || !puzzle) return;
    const moves = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    const key = event.key;
    if (/^[1-9]$/.test(key)) enterDigit(Number(key));
    else if (['Backspace', 'Delete', '0'].includes(key)) eraseCell();
    else if (moves[key]) moveSelection(...moves[key]);
    else if (key.toLowerCase() === 'n') toggleNotes();
    else if (key.toLowerCase() === 'z') undo();
    else return;
    event.preventDefault();
});

document.getElementById('undoBtn').onclick = undo;
document.getElementById('clearBtn').onclick = clearBoard;
document.getElementById('restartBtn').onclick = () => loadLevel(currentLevelIdx);

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
