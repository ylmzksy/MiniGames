let currentLevelIdx = 0;
let puzzle = null;
let dominoes = [];     // [{ a: [r, c], b: [r, c] }]
let selected = null;   // first cell of a tap-tap placement
let drag = null;       // start cell of a drag
let isSolved = false;
let statusKey = 'status_play';

const board = document.getElementById('game-board');
const trayEl = document.getElementById('tray');
const statusEl = document.getElementById('status');
const levelInfoEl = document.getElementById('level-info');
const countersEl = document.getElementById('counters');

function loadLevel(idx) {
    const level = LevelRegistry[idx];
    if (!level) return;

    currentLevelIdx = idx;
    Progress.setCurrent(idx);
    puzzle = DominosaEngine.parse(level);
    dominoes = [];
    selected = null;
    drag = null;
    isSolved = false;
    setStatus('status_play');
    updateLevelInfo();
    render();
}

function render() {
    const { width, height } = puzzle;
    board.style.gridTemplateColumns = `repeat(${width}, 1fr)`;
    board.style.maxWidth = `${width * 56}px`;
    const usage = DominosaEngine.usage(puzzle, dominoes);
    const cov = DominosaEngine.coverage(dominoes);

    const cells = [];
    for (let r = 0; r < height; r++) {
        for (let c = 0; c < width; c++) {
            const key = `${r},${c}`;
            const covered = cov.has(key);
            const classes = ['cell', covered ? 'covered' : '', selected && selected[0] === r && selected[1] === c ? 'selected' : ''].join(' ');
            cells.push(`<div class="${classes}" data-r="${r}" data-c="${c}"><span>${puzzle.numbers[r][c]}</span></div>`);
        }
    }
    const pct = (n, total) => `${(n / total) * 100}%`;
    const pills = dominoes.map((d, i) => {
        const r0 = Math.min(d.a[0], d.b[0]);
        const c0 = Math.min(d.a[1], d.b[1]);
        const horizontal = d.a[0] === d.b[0];
        const dup = usage[DominosaEngine.keyOf(puzzle, d)] > 1;
        return `<div class="domino ${horizontal ? 'h' : 'v'} ${dup ? 'dup' : ''} ${isSolved ? 'solved' : ''}" data-idx="${i}" style="left:${pct(c0, width)};top:${pct(r0, height)};width:${pct(horizontal ? 2 : 1, width)};height:${pct(horizontal ? 1 : 2, height)}"></div>`;
    }).join('');
    board.innerHTML = cells.join('') + pills;

    trayEl.innerHTML = puzzle.pairs.map(([x, y]) => {
        const n = usage[DominosaEngine.pairKey(x, y)] || 0;
        return `<span class="pair ${n === 1 ? 'used' : n > 1 ? 'dup' : ''}">${x}|${y}</span>`;
    }).join('');
    countersEl.innerText = `${i18n.t('placed')}: ${dominoes.length}/${puzzle.pairs.length}`;
}

function cellAt(event) {
    const el = document.elementFromPoint(event.clientX, event.clientY)?.closest('.cell');
    return el ? [Number(el.dataset.r), Number(el.dataset.c)] : null;
}

function place(a, b) {
    if (!DominosaEngine.canPlace(puzzle, dominoes, a, b)) return false;
    dominoes.push({ a, b });
    selected = null;
    render();
    checkSolved();
    return true;
}

function removeAt(cell) {
    const idx = DominosaEngine.coverage(dominoes).get(cell.join(','));
    if (idx === undefined) return false;
    dominoes.splice(idx, 1);
    selected = null;
    render();
    return true;
}

// Drag from a cell onto its neighbor places a domino; a tap on a domino removes it;
// tapping two neighboring free cells one after the other also places a domino
board.addEventListener('pointerdown', (event) => {
    if (isSolved) return;
    const cell = cellAt(event);
    if (!cell) return;
    event.preventDefault();
    drag = { start: cell, moved: false };
    board.setPointerCapture(event.pointerId);
});

board.addEventListener('pointermove', (event) => {
    if (!drag) return;
    const cell = cellAt(event);
    if (!cell || (cell[0] === drag.start[0] && cell[1] === drag.start[1])) return;
    if (Math.abs(cell[0] - drag.start[0]) + Math.abs(cell[1] - drag.start[1]) !== 1) return;
    drag.moved = true;
    const start = drag.start;
    drag = null;
    place(start, cell);
});

board.addEventListener('pointerup', (event) => {
    if (!drag) return;
    const start = drag.start;
    drag = null;
    const cov = DominosaEngine.coverage(dominoes);
    if (cov.has(start.join(','))) { removeAt(start); return; }
    if (selected && Math.abs(selected[0] - start[0]) + Math.abs(selected[1] - start[1]) === 1) {
        place(selected, start);
        return;
    }
    selected = selected && selected[0] === start[0] && selected[1] === start[1] ? null : start;
    render();
});
board.addEventListener('pointercancel', () => { drag = null; });

function checkSolved() {
    if (isSolved || !DominosaEngine.isSolved(puzzle, dominoes)) return;
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
    levelInfoEl.innerText = `${i18n.t('level')} ${currentLevelIdx + 1}/${LevelRegistry.length}: ${level.name} (0–${puzzle.max})`;
}

document.getElementById('restartBtn').onclick = () => loadLevel(currentLevelIdx);

window.addEventListener('langChanged', () => {
    setStatus(statusKey);
    updateLevelInfo();
    render();
});

// Initial Load
if (LevelRegistry.length > 0) loadLevel(Progress.startLevel());
