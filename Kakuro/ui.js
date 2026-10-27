const MAX_HINTS = 8; // combinations listed per run before "…"

let currentLevelIdx = 0;
let puzzle = null;
let values = [];     // values[r][c]: entered digit, 0 = empty
let notes = [];      // notes[r][c]: Set of pencil-mark digits
let selected = null; // [r, c] of the selected white cell
let notesMode = false;
let isSolved = false;
let statusKey = 'status_play';

const board = document.getElementById('game-board');
const statusEl = document.getElementById('status');
const levelInfoEl = document.getElementById('level-info');
const hintsEl = document.getElementById('hints');
const notesBtn = document.getElementById('notesBtn');

function loadLevel(idx) {
    const level = LevelRegistry[idx];
    if (!level) return;

    currentLevelIdx = idx;
    puzzle = KakuroEngine.parse(level);
    values = puzzle.cells.map(row => row.map(() => 0));
    notes = puzzle.cells.map(row => row.map(() => new Set()));
    selected = firstWhiteCell();
    isSolved = false;
    setStatus('status_play');
    updateLevelInfo();
    render();
}

function firstWhiteCell() {
    for (let r = 0; r < puzzle.height; r++) {
        for (let c = 0; c < puzzle.width; c++) {
            if (!puzzle.cells[r][c].block) return [r, c];
        }
    }
    return null;
}

function render() {
    board.style.gridTemplateColumns = `repeat(${puzzle.width}, 1fr)`;
    board.style.maxWidth = `${puzzle.width * 72}px`;

    const conflicts = KakuroEngine.conflicts(puzzle, values);
    // Clues of the selected cell's runs are highlighted, as "r,c,dir" keys
    const activeClues = new Set(selected
        ? KakuroEngine.runsAt(puzzle, ...selected).map(i => {
            const run = puzzle.runs[i];
            return `${run.clue[0]},${run.clue[1]},${run.dir}`;
        })
        : []);

    board.innerHTML = puzzle.cells.flatMap((row, r) => row.map((cell, c) =>
        cell.block ? renderBlock(cell, r, c, activeClues) : renderWhite(r, c, conflicts)
    )).join('');
    renderHints();
}

function renderBlock(cell, r, c, activeClues) {
    const hasClue = cell.across || cell.down;
    const active = dir => (activeClues.has(`${r},${c},${dir}`) ? 'active' : '');
    return `
        <div class="cell block ${hasClue ? 'clue' : ''}">
            ${cell.across ? `<span class="clue-across ${active('across')}">${cell.across}</span>` : ''}
            ${cell.down ? `<span class="clue-down ${active('down')}">${cell.down}</span>` : ''}
        </div>
    `;
}

function renderWhite(r, c, conflicts) {
    const key = `${r},${c}`;
    const value = values[r][c];
    const isSelected = selected && selected[0] === r && selected[1] === c;
    const classes = [
        'cell', 'white',
        isSelected ? 'selected' : '',
        conflicts.has(key) ? 'conflict' : '',
        isSolved ? 'solved' : ''
    ].join(' ');
    const content = value
        ? `<span class="value">${value}</span>`
        : `<div class="notes">${[1, 2, 3, 4, 5, 6, 7, 8, 9]
            .map(d => `<span>${notes[r][c].has(d) ? d : ''}</span>`).join('')}</div>`;
    return `<div class="${classes}" onclick="selectCell(${r}, ${c})">${content}</div>`;
}

// Lists the digit combinations that still fit the selected cell's runs
function renderHints() {
    if (!selected) {
        hintsEl.innerText = i18n.t('hint_select');
        return;
    }
    hintsEl.innerHTML = KakuroEngine.runsAt(puzzle, ...selected).map(i => {
        const run = puzzle.runs[i];
        const placed = run.cells.map(([r, c]) => values[r][c]).filter(Boolean);
        const combos = KakuroEngine.combinations(run.sum, run.cells.length)
            .filter(combo => placed.every(d => combo.includes(d)));
        const list = combos.length
            ? combos.slice(0, MAX_HINTS).map(combo => combo.join('+')).join(' · ') + (combos.length > MAX_HINTS ? ' …' : '')
            : i18n.t('hint_none');
        const arrow = run.dir === 'across' ? '→' : '↓';
        return `<div class="hint-line"><strong>${arrow} ${i18n.t('hint_run', { sum: run.sum, n: run.cells.length })}:</strong> ${list}</div>`;
    }).join('');
}

window.selectCell = (r, c) => {
    if (isSolved) return;
    selected = [r, c];
    render();
};

window.enterDigit = (d) => {
    if (!selected || isSolved) return;
    const [r, c] = selected;

    if (notesMode) {
        if (values[r][c]) return;
        const cellNotes = notes[r][c];
        cellNotes.has(d) ? cellNotes.delete(d) : cellNotes.add(d);
    } else {
        // Typing the same digit again clears the cell
        values[r][c] = values[r][c] === d ? 0 : d;
        if (values[r][c]) clearNotesInRuns(r, c, d);
    }
    render();
    checkSolved();
};

// A placed digit can no longer be a candidate elsewhere in the same runs
function clearNotesInRuns(r, c, d) {
    KakuroEngine.runsAt(puzzle, r, c).forEach(i => {
        puzzle.runs[i].cells.forEach(([nr, nc]) => notes[nr][nc].delete(d));
    });
}

window.eraseCell = () => {
    if (!selected || isSolved) return;
    const [r, c] = selected;
    values[r][c] = 0;
    notes[r][c].clear();
    render();
};

window.toggleNotes = () => {
    notesMode = !notesMode;
    notesBtn.classList.toggle('primary', notesMode);
};

// Moves the selection in a direction, skipping black cells
function moveSelection(dr, dc) {
    if (!selected) return;
    let [r, c] = selected;
    while (true) {
        r += dr;
        c += dc;
        if (r < 0 || c < 0 || r >= puzzle.height || c >= puzzle.width) return;
        if (!puzzle.cells[r][c].block) break;
    }
    selectCell(r, c);
}

function checkSolved() {
    if (!KakuroEngine.isSolved(puzzle, values)) return;
    isSolved = true;
    selected = null;
    setStatus('status_solved');
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
    statusEl.innerText = i18n.t(key);
}

function updateLevelInfo() {
    const level = LevelRegistry[currentLevelIdx];
    levelInfoEl.innerText = `${i18n.t('level')} ${currentLevelIdx + 1}/${LevelRegistry.length}: ${level.name}`;
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
    renderHints();
});

// Initial Load
if (LevelRegistry.length > 0) loadLevel(0);
