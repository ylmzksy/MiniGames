const CYCLE = [null, 'filled', 'cross']; // what a tap turns a cell into, in order

let currentLevelIdx = 0;
let puzzle = null;
let marks = [];
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
    puzzle = NonogramEngine.parse(level);
    marks = Array.from({ length: puzzle.height }, () => Array(puzzle.width).fill(null));
    isSolved = false;
    setStatus('status_play');
    updateLevelInfo();
    render();
}

function render() {
    const { width, height, rows, cols } = puzzle;
    const clueW = Math.max(...rows.map(r => r.length));
    const clueH = Math.max(...cols.map(c => c.length));
    board.style.gridTemplateColumns = `${clueW * 1.1}em repeat(${width}, 1fr)`;
    board.style.gridTemplateRows = `${clueH * 1.1}em repeat(${height}, auto)`;
    board.style.maxWidth = `${width * 40 + clueW * 18 + 20}px`;

    const rowStates = rows.map((clue, r) => NonogramEngine.lineState(clue, marks[r]));
    const colStates = cols.map((clue, c) => NonogramEngine.lineState(clue, NonogramEngine.column(marks, c)));
    const out = ['<div class="corner"></div>'];
    cols.forEach((clue, c) => out.push(`<div class="clue col ${colStates[c]}">${clue.map(n => `<span>${n}</span>`).join('')}</div>`));
    for (let r = 0; r < height; r++) {
        out.push(`<div class="clue row ${rowStates[r]}">${rows[r].map(n => `<span>${n}</span>`).join('')}</div>`);
        for (let c = 0; c < width; c++) {
            const classes = ['cell', marks[r][c] ?? 'empty', c % 5 === 4 && c < width - 1 ? 'gap-right' : '', r % 5 === 4 && r < height - 1 ? 'gap-bottom' : '', isSolved ? 'solved' : ''].join(' ');
            out.push(`<div class="${classes}" data-r="${r}" data-c="${c}"></div>`);
        }
    }
    board.innerHTML = out.join('');
    const filled = marks.flat().filter(m => m === 'filled').length;
    countersEl.innerText = `${i18n.t('filled')}: ${filled} · ${i18n.t('lines_done')}: ${rowStates.filter(s => s === 'ok').length + colStates.filter(s => s === 'ok').length}/${height + width}`;
}

function setCell(r, c, value) {
    if (isSolved || marks[r][c] === value) return;
    marks[r][c] = value;
    render();
    checkSolved();
}

function cellAt(event) {
    const el = document.elementFromPoint(event.clientX, event.clientY)?.closest('.cell');
    return el ? [Number(el.dataset.r), Number(el.dataset.c)] : null;
}

// Tap cycles empty → filled → cross; right-click cycles backwards.
// Dragging paints the state chosen by the first cell over the cells crossed.
board.addEventListener('pointerdown', (event) => {
    if (isSolved) return;
    const at = cellAt(event);
    if (!at) return;
    event.preventDefault();
    const [r, c] = at;
    const step = event.button === 2 ? -1 : 1;
    paint = CYCLE[(CYCLE.indexOf(marks[r][c]) + step + CYCLE.length) % CYCLE.length];
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
    if (!NonogramEngine.isSolved(puzzle, marks)) return;
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
