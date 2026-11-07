let currentLevelIdx = 0;
let puzzle = null;
let values = [];
let selected = null;
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
    puzzle = SkyscrapersEngine.parse(level);
    values = Array.from({ length: puzzle.size }, () => Array(puzzle.size).fill(0));
    selected = [0, 0];
    isSolved = false;
    setStatus('status_play');
    updateLevelInfo();
    renderPad();
    render();
}

function render() {
    const n = puzzle.size;
    board.style.gridTemplateColumns = `0.7fr repeat(${n}, 1fr) 0.7fr`;
    board.style.maxWidth = `${(n + 1.4) * 56}px`;

    const conflicts = SkyscrapersEngine.conflicts(puzzle, values);
    const E = SkyscrapersEngine;
    const clue = (side, i) => {
        const v = puzzle.clues[side][i];
        return `<div class="clue ${v ? E.clueState(puzzle, values, side, i) : ''}">${v || ''}</div>`;
    };
    const out = ['<div class="corner"></div>'];
    for (let c = 0; c < n; c++) out.push(clue('top', c));
    out.push('<div class="corner"></div>');
    for (let r = 0; r < n; r++) {
        out.push(clue('left', r));
        for (let c = 0; c < n; c++) {
            const isSelected = selected && selected[0] === r && selected[1] === c;
            const related = selected && !isSelected && (selected[0] === r || selected[1] === c);
            const classes = ['cell', isSelected ? 'selected' : '', related ? 'related' : '',
                conflicts.has(`${r},${c}`) ? 'conflict' : '', isSolved ? 'solved' : ''].join(' ');
            const v = values[r][c];
            out.push(`<div class="${classes}" onclick="selectCell(${r}, ${c})">${v ? `<span class="value">${v}</span><i class="tower" style="--h:${v / n}"></i>` : ''}</div>`);
        }
        out.push(clue('right', r));
    }
    out.push('<div class="corner"></div>');
    for (let c = 0; c < n; c++) out.push(clue('bottom', c));
    out.push('<div class="corner"></div>');
    board.innerHTML = out.join('');
}

function renderPad() {
    const digits = Array.from({ length: puzzle.size }, (_, i) => `<button onclick="enterDigit(${i + 1})">${i + 1}</button>`);
    padEl.style.gridTemplateColumns = `repeat(${Math.min(puzzle.size + 1, 7)}, 1fr)`;
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
    values[r][c] = values[r][c] === d ? 0 : d; // the same height again clears the cell
    render();
    checkSolved();
};

window.eraseCell = () => {
    if (!selected || isSolved) return;
    values[selected[0]][selected[1]] = 0;
    render();
};

function moveSelection(dr, dc) {
    if (!selected) return;
    const r = selected[0] + dr;
    const c = selected[1] + dc;
    if (r < 0 || c < 0 || r >= puzzle.size || c >= puzzle.size) return;
    selectCell(r, c);
}

function checkSolved() {
    if (!SkyscrapersEngine.isSolved(puzzle, values)) return;
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
