const CYCLE = [null, 'black', 'white']; // what a tap turns a cell into, in order

let currentLevelIdx = 0;
let puzzle = null;
let grid = [];          // grid[r][c]: 'black', 'white' or null (undecided)
let isSolved = false;
let statusKey = 'status_play';
let paint;              // state being painted while dragging; undefined otherwise

const board = document.getElementById('game-board');
const statusEl = document.getElementById('status');
const levelInfoEl = document.getElementById('level-info');
const countersEl = document.getElementById('counters');

function loadLevel(idx) {
    const level = LevelRegistry[idx];
    if (!level) return;

    currentLevelIdx = idx;
    Progress.setCurrent(idx);
    puzzle = MosaicEngine.parse(level);
    grid = puzzle.solution.map(row => row.map(() => null));
    isSolved = false;
    setStatus('status_play');
    updateLevelInfo();
    render();
}

function render() {
    board.style.gridTemplateColumns = `repeat(${puzzle.width}, 1fr)`;
    board.style.maxWidth = `${puzzle.width * 56}px`;

    const cells = [];
    for (let r = 0; r < puzzle.height; r++) {
        for (let c = 0; c < puzzle.width; c++) {
            const clue = puzzle.clues[r][c];
            const state = clue === null ? '' : MosaicEngine.clueState(puzzle, grid, r, c);
            const classes = ['cell', grid[r][c] ?? 'empty', state, isSolved ? 'solved' : ''].join(' ');
            cells.push(`<div class="${classes}" data-r="${r}" data-c="${c}">${clue ?? ''}</div>`);
        }
    }
    board.innerHTML = cells.join('');

    const decided = grid.flat().filter(v => v !== null).length;
    countersEl.innerText = `${i18n.t('filled')}: ${decided}/${puzzle.width * puzzle.height}`;
}

function setCell(r, c, value) {
    if (isSolved || grid[r][c] === value) return;
    grid[r][c] = value;
    render();
    checkSolved();
}

function cellAt(event) {
    const el = document.elementFromPoint(event.clientX, event.clientY);
    const cell = el?.closest('.cell');
    return cell ? [Number(cell.dataset.r), Number(cell.dataset.c)] : null;
}

// Tap cycles empty → black → white; right-click cycles backwards.
// Dragging paints the state chosen by the first cell over the cells crossed.
board.addEventListener('pointerdown', (event) => {
    if (isSolved) return;
    const at = cellAt(event);
    if (!at) return;
    event.preventDefault();
    const [r, c] = at;
    const step = event.button === 2 ? -1 : 1;
    paint = CYCLE[(CYCLE.indexOf(grid[r][c]) + step + CYCLE.length) % CYCLE.length];
    setCell(r, c, paint);
    board.setPointerCapture(event.pointerId);
});

board.addEventListener('pointermove', (event) => {
    if (paint === undefined) return;
    const at = cellAt(event);
    if (at) setCell(at[0], at[1], paint);
});

const stopPainting = () => { paint = undefined; };
window.addEventListener('pointerup', stopPainting);
window.addEventListener('pointercancel', stopPainting);
board.addEventListener('contextmenu', (event) => event.preventDefault());

function checkSolved() {
    if (!MosaicEngine.isSolved(puzzle, grid)) return;
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
