const CYCLE = [null, 'sea', 'white']; // what a tap turns a cell into, in order

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
    puzzle = NurikabeEngine.parse(level);
    marks = puzzle.numbers.map(row => row.map(() => null));
    isSolved = false;
    setStatus('status_play');
    updateLevelInfo();
    render();
}

function render() {
    const n = puzzle.width;
    board.style.gridTemplateColumns = `repeat(${n}, 1fr)`;
    board.style.maxWidth = `${n * 60}px`;

    const blocks = NurikabeEngine.seaBlocks(puzzle, marks);
    const islandBad = NurikabeEngine.islandErrors(puzzle, marks);
    const cells = [];
    for (let r = 0; r < puzzle.height; r++) {
        for (let c = 0; c < puzzle.width; c++) {
            const key = `${r},${c}`;
            const number = puzzle.numbers[r][c];
            const classes = ['cell', number !== null ? 'number' : (marks[r][c] ?? 'open'),
                blocks.has(key) || islandBad.has(key) ? 'bad' : '', isSolved ? 'solved' : ''].join(' ');
            cells.push(`<div class="${classes}" data-r="${r}" data-c="${c}">${number ?? ''}</div>`);
        }
    }
    board.innerHTML = cells.join('');

    const sea = marks.flat().filter(m => m === 'sea').length;
    const seas = NurikabeEngine.groups(puzzle, (r, c) => marks[r][c] === 'sea').length;
    countersEl.innerText = `${i18n.t('sea')}: ${sea}` + (seas > 1 ? ` · ${i18n.t('sea_split', { n: seas })}` : '');
}

function setCell(r, c, value) {
    if (isSolved || marks[r][c] === value) return;
    marks[r][c] = value;
    render();
    checkSolved();
}

// Tap cycles open → sea → white note; right-click cycles backwards. Numbered cells are fixed.
board.addEventListener('pointerdown', (event) => {
    const el = event.target.closest('.cell');
    if (!el || isSolved || el.classList.contains('number')) return;
    event.preventDefault();
    const r = Number(el.dataset.r);
    const c = Number(el.dataset.c);
    const step = event.button === 2 ? -1 : 1;
    setCell(r, c, CYCLE[(CYCLE.indexOf(marks[r][c]) + step + CYCLE.length) % CYCLE.length]);
});
board.addEventListener('contextmenu', (event) => event.preventDefault());

function checkSolved() {
    if (!NurikabeEngine.isSolved(puzzle, marks)) return;
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
