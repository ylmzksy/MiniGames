const CYCLE = [null, 'wall', 'dot'];

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
    puzzle = TapaEngine.parse(level);
    marks = puzzle.clues.map(row => row.map(() => null));
    isSolved = false;
    setStatus('status_play');
    updateLevelInfo();
    render();
}

function render() {
    board.style.gridTemplateColumns = `repeat(${puzzle.width}, 1fr)`;
    board.style.maxWidth = `${puzzle.width * 56}px`;

    const blocks = TapaEngine.blocks(puzzle, marks);
    const cells = [];
    for (let r = 0; r < puzzle.height; r++) {
        for (let c = 0; c < puzzle.width; c++) {
            const clue = puzzle.clues[r][c];
            if (clue) {
                const state = TapaEngine.clueState(puzzle, marks, r, c, isSolved); // once solved, unmarked cells count as empty
                cells.push(`<div class="cell clue ${state}">${clue.map(n => `<span>${n}</span>`).join('')}</div>`);
                continue;
            }
            const classes = ['cell', marks[r][c] ?? 'open', blocks.has(`${r},${c}`) ? 'bad' : '', isSolved ? 'solved' : ''].join(' ');
            cells.push(`<div class="${classes}" data-r="${r}" data-c="${c}">${marks[r][c] === 'dot' ? '•' : ''}</div>`);
        }
    }
    board.innerHTML = cells.join('');

    const connected = TapaEngine.isWallConnected(puzzle, marks);
    countersEl.innerText = `${i18n.t('shaded')}: ${TapaEngine.wallCount(marks)}` + (connected ? '' : ` · ${i18n.t('split')}`);
}

function setCell(r, c, value) {
    if (isSolved || marks[r][c] === value) return;
    marks[r][c] = value;
    render();
    checkSolved();
}

// Tap cycles empty → wall → dot; right-click cycles backwards; clue cells are fixed
board.addEventListener('pointerdown', (event) => {
    const el = event.target.closest('.cell');
    if (!el || isSolved || el.classList.contains('clue')) return;
    event.preventDefault();
    const r = Number(el.dataset.r);
    const c = Number(el.dataset.c);
    const step = event.button === 2 ? -1 : 1;
    setCell(r, c, CYCLE[(CYCLE.indexOf(marks[r][c]) + step + CYCLE.length) % CYCLE.length]);
});
board.addEventListener('contextmenu', (event) => event.preventDefault());

function checkSolved() {
    if (!TapaEngine.isSolved(puzzle, marks)) return;
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
    levelInfoEl.innerText = `${i18n.t('level')} ${currentLevelIdx + 1}/${LevelRegistry.length}: ${level.name} (${puzzle.width}×${puzzle.height})`;
}

document.getElementById('restartBtn').onclick = () => loadLevel(currentLevelIdx);

window.addEventListener('langChanged', () => {
    setStatus(statusKey);
    updateLevelInfo();
    render();
});

// Initial Load
if (LevelRegistry.length > 0) loadLevel(Progress.startLevel());
