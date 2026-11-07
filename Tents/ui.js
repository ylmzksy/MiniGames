const CYCLE = [null, 'tent', 'grass']; // what a tap turns a free cell into, in order

let currentLevelIdx = 0;
let puzzle = null;
let marks = [];
let isSolved = false;
let statusKey = 'status_play';

const board = document.getElementById('game-board');
const statusEl = document.getElementById('status');
const levelInfoEl = document.getElementById('level-info');
const countersEl = document.getElementById('counters');

function loadLevel(idx) {
    const level = LevelRegistry[idx];
    if (!level) return;

    currentLevelIdx = idx;
    Progress.setCurrent(idx);
    puzzle = TentsEngine.parse(level);
    marks = puzzle.trees.map(row => row.map(() => null));
    isSolved = false;
    setStatus('status_play');
    updateLevelInfo();
    render();
}

function countState(have, need, open) {
    if (have > need) return 'bad';
    return have === need ? 'ok' : '';
}

function render() {
    const { width, height } = puzzle;
    board.style.gridTemplateColumns = `repeat(${width}, 1fr) 0.7fr`;
    board.style.maxWidth = `${(width + 0.7) * 48}px`;
    const touching = TentsEngine.touching(marks);

    const cells = [];
    for (let r = 0; r < height; r++) {
        for (let c = 0; c < width; c++) {
            const tree = puzzle.trees[r][c];
            const classes = ['cell', tree ? 'tree' : (marks[r][c] ?? 'open'), touching.has(`${r},${c}`) ? 'bad' : '', isSolved ? 'solved' : ''].join(' ');
            cells.push(`<div class="${classes}" data-r="${r}" data-c="${c}"></div>`);
        }
        const have = TentsEngine.rowCount(marks, r);
        cells.push(`<div class="clue ${countState(have, puzzle.rows[r])}">${puzzle.rows[r]}</div>`);
    }
    for (let c = 0; c < width; c++) {
        const have = TentsEngine.colCount(marks, c);
        cells.push(`<div class="clue ${countState(have, puzzle.cols[c])}">${puzzle.cols[c]}</div>`);
    }
    cells.push('<div class="clue corner"></div>');
    board.innerHTML = cells.join('');

    const tents = TentsEngine.tents(marks).length;
    const trees = puzzle.trees.flat().filter(Boolean).length;
    countersEl.innerText = `${i18n.t('tents')}: ${tents}/${trees}`;
}

function setCell(r, c, value) {
    if (isSolved || puzzle.trees[r][c] || marks[r][c] === value) return;
    marks[r][c] = value;
    render();
    checkSolved();
}

// Tap cycles open → tent → grass; right-click cycles backwards
board.addEventListener('pointerdown', (event) => {
    const el = event.target.closest('.cell');
    if (!el || isSolved) return;
    event.preventDefault();
    const r = Number(el.dataset.r);
    const c = Number(el.dataset.c);
    if (puzzle.trees[r][c]) return;
    const step = event.button === 2 ? -1 : 1;
    setCell(r, c, CYCLE[(CYCLE.indexOf(marks[r][c]) + step + CYCLE.length) % CYCLE.length]);
});
board.addEventListener('contextmenu', (event) => event.preventDefault());

function checkSolved() {
    if (!TentsEngine.isSolved(puzzle, marks)) return;
    isSolved = true;
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
    statusEl.innerText = i18n.t(key);
}

function updateLevelInfo() {
    const level = LevelRegistry[currentLevelIdx];
    levelInfoEl.innerText = `${i18n.t('level')} ${currentLevelIdx + 1}/${LevelRegistry.length}: ${level.name}`;
}

document.getElementById('restartBtn').onclick = () => loadLevel(currentLevelIdx);

window.addEventListener('langChanged', () => {
    setStatus(statusKey);
    updateLevelInfo();
    render();
});

// Initial Load
if (LevelRegistry.length > 0) loadLevel(Progress.startLevel());
