let currentLevelIdx = 0;
let puzzle = null;
let values = [];     // values[r][c]: entered digit, 0 = empty
let notes = [];      // notes[r][c]: Set of pencil-mark digits
let selected = null; // [r, c]
let notesMode = false;
let isSolved = false;
let statusKey = 'status_play';

const board = document.getElementById('game-board');
const padEl = document.getElementById('pad');
const statusEl = document.getElementById('status');
const levelInfoEl = document.getElementById('level-info');
const notesBtn = document.getElementById('notesBtn');

function loadLevel(idx) {
    const level = LevelRegistry[idx];
    if (!level) return;

    currentLevelIdx = idx;
    Progress.setCurrent(idx);
    puzzle = SudokuEngine.parse(level);
    values = puzzle.givens.map(row => [...row]);
    notes = puzzle.givens.map(row => row.map(() => new Set()));
    selected = firstEmpty();
    isSolved = false;
    setStatus('status_play');
    updateLevelInfo();
    renderPad();
    render();
}

function firstEmpty() {
    for (let r = 0; r < puzzle.size; r++) {
        for (let c = 0; c < puzzle.size; c++) {
            if (!puzzle.givens[r][c]) return [r, c];
        }
    }
    return null;
}

function render() {
    const n = puzzle.size;
    board.style.gridTemplateColumns = `repeat(${n}, 1fr)`;
    board.style.maxWidth = `${n * 56}px`;
    board.style.setProperty('--note-cols', puzzle.boxCols);

    const conflicts = SudokuEngine.conflicts(puzzle, values);
    const cells = [];
    for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
            const given = puzzle.givens[r][c] !== 0;
            const isSelected = selected && selected[0] === r && selected[1] === c;
            const sameBox = selected && SudokuEngine.boxOf(puzzle, r, c) === SudokuEngine.boxOf(puzzle, ...selected);
            const related = selected && !isSelected && (selected[0] === r || selected[1] === c || sameBox);
            const classes = ['cell', given ? 'given' : '', isSelected ? 'selected' : '', related ? 'related' : '',
                conflicts.has(`${r},${c}`) ? 'conflict' : '', isSolved ? 'solved' : '',
                c % puzzle.boxCols === 0 ? 'box-left' : '', r % puzzle.boxRows === 0 ? 'box-top' : ''].join(' ');
            const value = values[r][c];
            const content = value
                ? `<span class="value">${value}</span>`
                : `<div class="notes">${Array.from({ length: n }, (_, i) => `<span>${notes[r][c].has(i + 1) ? i + 1 : ''}</span>`).join('')}</div>`;
            cells.push(`<div class="${classes}" onclick="selectCell(${r}, ${c})">${content}</div>`);
        }
    }
    board.innerHTML = cells.join('');
}

function renderPad() {
    const digits = Array.from({ length: puzzle.size }, (_, i) => `<button onclick="enterDigit(${i + 1})">${i + 1}</button>`);
    padEl.style.gridTemplateColumns = `repeat(${Math.min(puzzle.size + 1, 5)}, 1fr)`;
    padEl.innerHTML = digits.join('') + `<button onclick="eraseCell()">${i18n.t('erase')}</button>`;
}

window.selectCell = (r, c) => {
    if (isSolved) return;
    selected = [r, c];
    render();
};

window.enterDigit = (d) => {
    if (!selected || isSolved || d > puzzle.size) return;
    const [r, c] = selected;
    if (puzzle.givens[r][c]) return;

    if (notesMode) {
        if (values[r][c]) return;
        const cellNotes = notes[r][c];
        cellNotes.has(d) ? cellNotes.delete(d) : cellNotes.add(d);
    } else {
        values[r][c] = values[r][c] === d ? 0 : d; // the same digit again clears the cell
        if (values[r][c]) clearNotesAround(r, c, d);
    }
    render();
    checkSolved();
};

// A placed digit can no longer be a candidate in its row, column or box
function clearNotesAround(r, c, d) {
    for (let i = 0; i < puzzle.size; i++) {
        notes[r][i].delete(d);
        notes[i][c].delete(d);
    }
    const box = SudokuEngine.boxOf(puzzle, r, c);
    for (let rr = 0; rr < puzzle.size; rr++) {
        for (let cc = 0; cc < puzzle.size; cc++) {
            if (SudokuEngine.boxOf(puzzle, rr, cc) === box) notes[rr][cc].delete(d);
        }
    }
}

window.eraseCell = () => {
    if (!selected || isSolved) return;
    const [r, c] = selected;
    if (puzzle.givens[r][c]) return;
    values[r][c] = 0;
    notes[r][c].clear();
    render();
};

window.toggleNotes = () => {
    notesMode = !notesMode;
    notesBtn.classList.toggle('primary', notesMode);
};

// Moves the selection, skipping given cells
function moveSelection(dr, dc) {
    if (!selected) return;
    let [r, c] = selected;
    while (true) {
        r += dr;
        c += dc;
        if (r < 0 || c < 0 || r >= puzzle.size || c >= puzzle.size) return;
        if (!puzzle.givens[r][c]) break;
    }
    selectCell(r, c);
}

function checkSolved() {
    if (!SudokuEngine.isSolved(puzzle, values)) return;
    isSolved = true;
    selected = null;
    setStatus('status_solved');
    Progress.markSolved(currentLevelIdx);
    render();
    const solvedLevelIdx = currentLevelIdx;
    setTimeout(() => {
        if (solvedLevelIdx === currentLevelIdx) nextLevel();
    }, 1800);
}

function nextLevel() {
    if (currentLevelIdx + 1 < LevelRegistry.length) {
        loadLevel(currentLevelIdx + 1);
    } else {
        setStatus('all_levels_cleared');
    }
}

function setStatus(key) {
    statusKey = key;
    statusEl.innerText = i18n.t(key, { n: puzzle.size });
}

function updateLevelInfo() {
    const level = LevelRegistry[currentLevelIdx];
    levelInfoEl.innerText = `${i18n.t('level')} ${currentLevelIdx + 1}/${LevelRegistry.length}: ${level.name} (${puzzle.size}×${puzzle.size})`;
}

document.addEventListener('keydown', (event) => {
    const inFormControl = event.target instanceof Element && event.target.closest('select, input');
    if (inFormControl || document.querySelector('.modal.active')) return;
    const moves = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    if (/^[1-9]$/.test(event.key)) {
        enterDigit(Number(event.key));
    } else if (['Backspace', 'Delete', '0'].includes(event.key)) {
        eraseCell();
    } else if (moves[event.key]) {
        moveSelection(...moves[event.key]);
    } else if (event.key.toLowerCase() === 'n') {
        toggleNotes();
    } else {
        return;
    }
    event.preventDefault();
});

document.getElementById('restartBtn').onclick = () => loadLevel(currentLevelIdx);

window.addEventListener('langChanged', () => {
    setStatus(statusKey);
    updateLevelInfo();
    renderPad();
});

// Initial Load
if (LevelRegistry.length > 0) loadLevel(Progress.startLevel());
