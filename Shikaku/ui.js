const COLORS = ['#ffd6a5', '#caffbf', '#9bf6ff', '#bdb2ff', '#ffc6ff', '#fdffb6', '#a0c4ff', '#ffadad', '#d4f1c5', '#f1c0e8', '#c7f9cc', '#ffe5b4'];

let currentLevelIdx = 0;
let puzzle = null;
let rects = [];      // placed rectangles { r, c, h, w, color }
let colorIdx = 0;
let drag = null;     // { start: [r, c], end: [r, c], moved }
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
    puzzle = ShikakuEngine.parse(level);
    rects = [];
    colorIdx = 0;
    drag = null;
    isSolved = false;
    setStatus('status_play');
    updateLevelInfo();
    render();
}

function dragRect() {
    if (!drag) return null;
    const [r1, c1] = drag.start;
    const [r2, c2] = drag.end;
    return { r: Math.min(r1, r2), c: Math.min(c1, c2), h: Math.abs(r1 - r2) + 1, w: Math.abs(c1 - c2) + 1 };
}

function render() {
    const { width, height } = puzzle;
    board.style.gridTemplateColumns = `repeat(${width}, 1fr)`;
    board.style.maxWidth = `${width * 52}px`;
    const preview = dragRect();

    const cells = [];
    for (let r = 0; r < height; r++) {
        for (let c = 0; c < width; c++) {
            const rect = ShikakuEngine.rectAt(rects, r, c);
            const bad = rect && !ShikakuEngine.isValid(puzzle, rect);
            const edges = rect ? [
                r === rect.r ? 'top' : '', r === rect.r + rect.h - 1 ? 'bottom' : '',
                c === rect.c ? 'left' : '', c === rect.c + rect.w - 1 ? 'right' : ''].join(' ') : '';
            const classes = ['cell', rect ? 'filled' : '', bad ? 'bad' : '', edges,
                preview && ShikakuEngine.contains(preview, r, c) ? 'preview' : '', isSolved ? 'solved' : ''].join(' ');
            const style = rect ? `style="--fill:${rect.color}"` : '';
            cells.push(`<div class="${classes}" ${style} data-r="${r}" data-c="${c}">${puzzle.numbers[r][c] || ''}</div>`);
        }
    }
    board.innerHTML = cells.join('');
    countersEl.innerText = `${i18n.t('covered')}: ${ShikakuEngine.covered(rects)}/${width * height}`;
}

function cellAt(event) {
    const el = document.elementFromPoint(event.clientX, event.clientY)?.closest('.cell');
    return el ? [Number(el.dataset.r), Number(el.dataset.c)] : null;
}

// Drag across cells to draw a rectangle; a plain tap removes the rectangle under it
board.addEventListener('pointerdown', (event) => {
    if (isSolved) return;
    const cell = cellAt(event);
    if (!cell) return;
    event.preventDefault();
    drag = { start: cell, end: cell, moved: false };
    board.setPointerCapture(event.pointerId);
    render();
});

board.addEventListener('pointermove', (event) => {
    if (!drag) return;
    const cell = cellAt(event);
    if (!cell || (cell[0] === drag.end[0] && cell[1] === drag.end[1])) return;
    drag.end = cell;
    drag.moved = true;
    render();
});

function finishDrag() {
    if (!drag) return;
    const rect = dragRect();
    const [r, c] = drag.start;
    drag = null;
    if (rect.w === 1 && rect.h === 1) {
        const existing = ShikakuEngine.rectAt(rects, r, c);
        if (existing) rects = rects.filter(x => x !== existing);
    } else {
        rect.color = COLORS[colorIdx++ % COLORS.length];
        rects = ShikakuEngine.add(rects, rect);
    }
    render();
    checkSolved();
}
board.addEventListener('pointerup', finishDrag);
board.addEventListener('pointercancel', () => { drag = null; render(); });

function checkSolved() {
    if (isSolved || !ShikakuEngine.isSolved(puzzle, rects)) return;
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
