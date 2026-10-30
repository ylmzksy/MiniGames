const CYCLE = [null, 'bulb', 'dot']; // what a tap turns a white cell into, in order

let currentLevelIdx = 0;
let puzzle = null;
let marks = [];        // marks[r][c]: 'bulb', 'dot' or null
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
    puzzle = AkariEngine.parse(level);
    marks = puzzle.black.map(row => row.map(() => null));
    isSolved = false;
    setStatus('status_play');
    updateLevelInfo();
    render();
}

function render() {
    const { width, height } = puzzle;
    board.style.gridTemplateColumns = `repeat(${width}, 1fr)`;
    board.style.maxWidth = `${width * 52}px`;

    const { lit, clashing } = AkariEngine.light(puzzle, marks);
    const cells = [];
    let unlit = 0;
    for (let r = 0; r < height; r++) {
        for (let c = 0; c < width; c++) {
            const key = `${r},${c}`;
            if (puzzle.black[r][c]) {
                const n = puzzle.numbers[r][c];
                const state = n === null ? '' : AkariEngine.numberState(puzzle, marks, r, c);
                cells.push(`<div class="cell black ${state}">${n ?? ''}</div>`);
                continue;
            }
            const isLit = lit.has(key);
            if (!isLit) unlit++;
            const classes = ['cell', 'white', marks[r][c] ?? '', isLit ? 'lit' : '', clashing.has(key) ? 'clash' : '', isSolved ? 'solved' : ''].join(' ');
            cells.push(`<div class="${classes}" data-r="${r}" data-c="${c}">${marks[r][c] === 'bulb' ? '💡' : marks[r][c] === 'dot' ? '•' : ''}</div>`);
        }
    }
    board.innerHTML = cells.join('');

    const bulbs = marks.flat().filter(m => m === 'bulb').length;
    countersEl.innerText = `${i18n.t('bulbs')}: ${bulbs} · ${i18n.t('unlit')}: ${unlit}`;
}

function setCell(r, c, value) {
    if (isSolved || marks[r][c] === value) return;
    marks[r][c] = value;
    render();
    checkSolved();
}

// Tap cycles empty → bulb → dot; right-click cycles backwards
board.addEventListener('pointerdown', (event) => {
    const el = event.target.closest('.cell.white');
    if (!el || isSolved) return;
    event.preventDefault();
    const r = Number(el.dataset.r);
    const c = Number(el.dataset.c);
    const step = event.button === 2 ? -1 : 1;
    setCell(r, c, CYCLE[(CYCLE.indexOf(marks[r][c]) + step + CYCLE.length) % CYCLE.length]);
});
board.addEventListener('contextmenu', (event) => event.preventDefault());

function checkSolved() {
    if (!AkariEngine.isSolved(puzzle, marks)) return;
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
