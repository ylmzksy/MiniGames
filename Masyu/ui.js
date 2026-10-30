let currentLevelIdx = 0;
let puzzle = null;
let lines = new Set();   // edge keys with a line
let crosses = new Set(); // edge keys marked as "no line"
let isSolved = false;
let statusKey = 'status_play';
let drag = null;         // { last: [r, c], mode: 'draw' | 'erase' | null }

const board = document.getElementById('game-board');
const statusEl = document.getElementById('status');
const levelInfoEl = document.getElementById('level-info');
const countersEl = document.getElementById('counters');

function loadLevel(idx) {
    const level = LevelRegistry[idx];
    if (!level) return;

    currentLevelIdx = idx;
    Progress.setCurrent(idx);
    puzzle = MasyuEngine.parse(level);
    lines = new Set();
    crosses = new Set();
    isSolved = false;
    setStatus('status_play');
    updateLevelInfo();
    render();
}

function render() {
    const { width, height } = puzzle;
    const track = n => Array.from({ length: 2 * n - 1 }, (_, i) => i % 2 === 0 ? '1fr' : '0.5fr').join(' ');
    board.style.gridTemplateColumns = track(width);
    board.style.gridTemplateRows = track(height);
    board.style.maxWidth = `${width * 56 + (width - 1) * 28}px`;

    const badCells = MasyuEngine.badCells(puzzle, lines);
    const out = [];
    for (let gr = 0; gr < 2 * height - 1; gr++) {
        for (let gc = 0; gc < 2 * width - 1; gc++) {
            if (gr % 2 === 0 && gc % 2 === 0) {
                out.push(renderCell(gr / 2, gc / 2, badCells));
            } else if (gr % 2 === 0) {
                out.push(renderEdge([gr / 2, (gc - 1) / 2], [gr / 2, (gc + 1) / 2], 'h'));
            } else if (gc % 2 === 0) {
                out.push(renderEdge([(gr - 1) / 2, gc / 2], [(gr + 1) / 2, gc / 2], 'v'));
            } else {
                out.push('<div class="corner"></div>');
            }
        }
    }
    board.innerHTML = out.join('');
    countersEl.innerText = `${i18n.t('segments')}: ${lines.size}`;
}

function renderCell(r, c, badCells) {
    const key = `${r},${c}`;
    const kind = puzzle.circles.get(key);
    const state = kind ? MasyuEngine.circleState(puzzle, lines, r, c) : '';
    const stubs = MasyuEngine.lineDirs(puzzle, lines, r, c).map(d => `<i class="stub ${d}"></i>`).join('');
    const circle = kind ? `<span class="circle ${kind === 'W' ? 'white' : 'black'} ${state}"></span>` : '<span class="dot"></span>';
    const classes = ['cell', badCells.has(key) ? 'bad' : '', isSolved ? 'solved' : ''].join(' ');
    return `<div class="${classes}" data-r="${r}" data-c="${c}">${stubs}${circle}</div>`;
}

function renderEdge(a, b, orientation) {
    const key = MasyuEngine.edgeKey(a, b);
    const state = lines.has(key) ? 'line' : crosses.has(key) ? 'cross' : '';
    return `<div class="edge ${orientation} ${state}" data-key="${key}"></div>`;
}

// Clicking an edge cycles empty → line → cross → empty
function cycleEdge(key) {
    if (lines.has(key)) { lines.delete(key); crosses.add(key); }
    else if (crosses.has(key)) crosses.delete(key);
    else lines.add(key);
    afterChange();
}

function setLine(key, on) {
    if (on) { lines.add(key); crosses.delete(key); } else lines.delete(key);
    afterChange();
}

function afterChange() {
    render();
    checkSolved();
}

function cellAt(event) {
    const el = document.elementFromPoint(event.clientX, event.clientY)?.closest('.cell');
    return el ? [Number(el.dataset.r), Number(el.dataset.c)] : null;
}

// Dragging from cell to cell draws the line along the way (or erases, if it started on a line)
board.addEventListener('pointerdown', (event) => {
    if (isSolved) return;
    const edge = event.target.closest('.edge');
    if (edge) { event.preventDefault(); cycleEdge(edge.dataset.key); return; }
    const cell = cellAt(event);
    if (!cell) return;
    event.preventDefault();
    drag = { last: cell, mode: null };
    board.setPointerCapture(event.pointerId);
});

board.addEventListener('pointermove', (event) => {
    if (!drag) return;
    const cell = cellAt(event);
    if (!cell || (cell[0] === drag.last[0] && cell[1] === drag.last[1])) return;
    const adjacent = Math.abs(cell[0] - drag.last[0]) + Math.abs(cell[1] - drag.last[1]) === 1;
    if (!adjacent) return;
    const key = MasyuEngine.edgeKey(drag.last, cell);
    if (!drag.mode) drag.mode = lines.has(key) ? 'erase' : 'draw';
    drag.last = cell;
    setLine(key, drag.mode === 'draw');
});

const endDrag = () => { drag = null; };
board.addEventListener('pointerup', endDrag);
board.addEventListener('pointercancel', endDrag);

function checkSolved() {
    if (isSolved || !MasyuEngine.isSolved(puzzle, lines)) return;
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
