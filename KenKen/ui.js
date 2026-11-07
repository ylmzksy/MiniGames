let currentLevelIdx = 0;
let puzzle = null;
let values = [];
let notes = [];
let selected = null;
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
    puzzle = KenKenEngine.parse(level);
    values = Array.from({ length: puzzle.size }, () => Array(puzzle.size).fill(0));
    notes = Array.from({ length: puzzle.size }, () => Array.from({ length: puzzle.size }, () => new Set()));
    selected = [0, 0];
    isSolved = false;
    setStatus('status_play');
    updateLevelInfo();
    renderPad();
    render();
}

function render() {
    const n = puzzle.size;
    board.style.gridTemplateColumns = `repeat(${n}, 1fr)`;
    board.style.maxWidth = `${n * 66}px`;
    const conflicts = KenKenEngine.conflicts(puzzle, values);
    const cageStates = puzzle.cages.map(cage => KenKenEngine.cageState(cage, values));
    const cells = [];
    for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
            const cageIdx = puzzle.cageOf[r][c];
            const cage = puzzle.cages[cageIdx];
            const borders = ['top', 'bottom', 'left', 'right'].filter(side => {
                const [dr, dc] = { top: [-1, 0], bottom: [1, 0], left: [0, -1], right: [0, 1] }[side];
                const nr = r + dr;
                const nc = c + dc;
                return nr < 0 || nc < 0 || nr >= n || nc >= n || puzzle.cageOf[nr][nc] !== cageIdx;
            }).map(side => `wall-${side}`);
            const isLabel = puzzle.labelCell[cageIdx][0] === r && puzzle.labelCell[cageIdx][1] === c;
            const label = isLabel ? `<span class="label ${cageStates[cageIdx]}">${cage.target}${KenKenEngine.opSymbol(cage.op)}</span>` : '';
            const isSelected = selected && selected[0] === r && selected[1] === c;
            const classes = ['cell', ...borders, `cage-${cageStates[cageIdx] || 'open'}`, isSelected ? 'selected' : '',
                conflicts.has(`${r},${c}`) ? 'conflict' : '', isSolved ? 'solved' : ''].join(' ');
            const content = values[r][c]
                ? `<span class="value">${values[r][c]}</span>`
                : `<div class="notes">${Array.from({ length: n }, (_, i) => `<span>${notes[r][c].has(i + 1) ? i + 1 : ''}</span>`).join('')}</div>`;
            cells.push(`<div class="${classes}" onclick="selectCell(${r}, ${c})">${label}${content}</div>`);
        }
    }
    board.innerHTML = cells.join('');
}

function renderPad() {
    const n = puzzle.size;
    padEl.style.gridTemplateColumns = `repeat(${Math.min(n + 1, 7)}, 1fr)`;
    padEl.innerHTML = Array.from({ length: n }, (_, i) => `<button onclick="enterDigit(${i + 1})">${i + 1}</button>`).join('')
        + `<button onclick="eraseCell()">${i18n.t('erase')}</button>`;
}

window.selectCell = (r, c) => {
    if (isSolved) return;
    selected = [r, c];
    render();
};

window.enterDigit = (d) => {
    if (!selected || isSolved || d > puzzle.size) return;
    const [r, c] = selected;
    if (notesMode) {
        if (values[r][c]) return;
        notes[r][c].has(d) ? notes[r][c].delete(d) : notes[r][c].add(d);
    } else {
        values[r][c] = values[r][c] === d ? 0 : d;
        if (values[r][c]) {
            for (let k = 0; k < puzzle.size; k++) { notes[r][k].delete(d); notes[k][c].delete(d); }
        }
    }
    render();
    checkSolved();
};

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

function moveSelection(dr, dc) {
    if (!selected) return;
    const r = selected[0] + dr;
    const c = selected[1] + dc;
    if (r < 0 || c < 0 || r >= puzzle.size || c >= puzzle.size) return;
    selectCell(r, c);
}

function checkSolved() {
    if (!KenKenEngine.isSolved(puzzle, values)) return;
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
    if (/^[1-9]$/.test(event.key)) enterDigit(Number(event.key));
    else if (['Backspace', 'Delete', '0'].includes(event.key)) eraseCell();
    else if (moves[event.key]) moveSelection(...moves[event.key]);
    else if (event.key.toLowerCase() === 'n') toggleNotes();
    else return;
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
