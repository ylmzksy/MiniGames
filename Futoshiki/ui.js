let currentLevelIdx = 0;
let puzzle = null;
let values = [];     // values[r][c]: entered digit, 0 = empty
let selected = null; // [r, c]
let isSolved = false;
let statusKey = 'status_play';

const board = document.getElementById('game-board');
const padEl = document.getElementById('pad');
const statusEl = document.getElementById('status');
const levelInfoEl = document.getElementById('level-info');

function loadLevel(idx) {
    const level = LevelRegistry[idx];
    if (!level) return;

    currentLevelIdx = idx;
    Progress.setCurrent(idx);
    puzzle = FutoshikiEngine.parse(level);
    values = puzzle.givens.map(row => [...row]);
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
    const track = Array.from({ length: 2 * n - 1 }, (_, i) => i % 2 === 0 ? '1fr' : '0.42fr').join(' ');
    board.style.gridTemplateColumns = track;
    board.style.gridTemplateRows = track;
    board.style.maxWidth = `${n * 64 + (n - 1) * 26}px`;

    const { cells: conflictCells, signs: badSigns } = FutoshikiEngine.conflicts(puzzle, values);
    const badKeys = new Set(badSigns.map(({ a, b }) => `${a.join(',')}|${b.join(',')}`));
    const out = [];
    for (let r = 0; r < 2 * n - 1; r++) {
        for (let c = 0; c < 2 * n - 1; c++) {
            if (r % 2 === 0 && c % 2 === 0) {
                out.push(renderCell(r / 2, c / 2, conflictCells));
            } else if (r % 2 === 0) {
                const sign = puzzle.across[r / 2][(c - 1) / 2];
                const bad = badKeys.has(`${r / 2},${(c - 1) / 2}|${r / 2},${(c + 1) / 2}`);
                out.push(`<div class="sign ${bad ? 'bad' : ''}">${sign ?? ''}</div>`);
            } else if (c % 2 === 0) {
                const sign = puzzle.down[(r - 1) / 2][c / 2];
                const bad = badKeys.has(`${(r - 1) / 2},${c / 2}|${(r + 1) / 2},${c / 2}`);
                out.push(`<div class="sign ${bad ? 'bad' : ''}">${sign === '>' ? '∨' : sign === '<' ? '∧' : ''}</div>`);
            } else {
                out.push('<div class="gap"></div>');
            }
        }
    }
    board.innerHTML = out.join('');
}

function renderCell(r, c, conflictCells) {
    const given = puzzle.givens[r][c] !== 0;
    const isSelected = selected && selected[0] === r && selected[1] === c;
    const classes = ['cell', given ? 'given' : '', isSelected ? 'selected' : '',
        conflictCells.has(`${r},${c}`) ? 'conflict' : '', isSolved ? 'solved' : ''].join(' ');
    return `<div class="${classes}" onclick="selectCell(${r}, ${c})">${values[r][c] || ''}</div>`;
}

function renderPad() {
    const digits = Array.from({ length: puzzle.size }, (_, i) => `<button onclick="enterDigit(${i + 1})">${i + 1}</button>`);
    padEl.style.gridTemplateColumns = `repeat(${puzzle.size + 1}, 1fr)`;
    padEl.innerHTML = digits.join('') + `<button onclick="eraseCell()" data-i18n="erase">${i18n.t('erase')}</button>`;
}

window.selectCell = (r, c) => {
    if (isSolved || puzzle.givens[r][c]) return;
    selected = [r, c];
    render();
};

window.enterDigit = (d) => {
    if (!selected || isSolved || d > puzzle.size) return;
    const [r, c] = selected;
    values[r][c] = values[r][c] === d ? 0 : d; // the same digit again clears the cell
    render();
    checkSolved();
};

window.eraseCell = () => {
    if (!selected || isSolved) return;
    values[selected[0]][selected[1]] = 0;
    render();
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
    if (!FutoshikiEngine.isSolved(puzzle, values)) return;
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
