let currentLevelIdx = 0;
let puzzle = null;
let lines = new Set();
let crosses = new Set();
let isSolved = false;
let statusKey = 'status_play';
let drag = null;   // { last: [r, c] of a dot, mode: 'draw' | 'erase' | null }

const board = document.getElementById('game-board');
const statusEl = document.getElementById('status');
const levelInfoEl = document.getElementById('level-info');
const countersEl = document.getElementById('counters');

function loadLevel(idx) {
    const level = LevelRegistry[idx];
    if (!level) return;

    currentLevelIdx = idx;
    Progress.setCurrent(idx);
    puzzle = SlitherlinkEngine.parse(level);
    lines = new Set();
    crosses = new Set();
    isSolved = false;
    setStatus('status_play');
    updateLevelInfo();
    render();
}

function render() {
    const { width, height } = puzzle;
    const track = n => Array.from({ length: 2 * n + 1 }, (_, i) => i % 2 === 0 ? '12px' : '1fr').join(' ');
    board.style.gridTemplateColumns = track(width);
    board.style.gridTemplateRows = track(height);
    board.style.maxWidth = `${width * 56 + (width + 1) * 12}px`;

    const badDots = SlitherlinkEngine.badDots(puzzle, lines);
    const out = [];
    for (let gr = 0; gr <= 2 * height; gr++) {
        for (let gc = 0; gc <= 2 * width; gc++) {
            const r = gr / 2;
            const c = gc / 2;
            if (gr % 2 === 0 && gc % 2 === 0) {
                out.push(`<div class="dot ${badDots.has(`${r},${c}`) ? 'bad' : ''}" data-r="${r}" data-c="${c}"></div>`);
            } else if (gr % 2 === 0) {
                out.push(renderEdge(`h,${r},${(gc - 1) / 2}`, 'h'));
            } else if (gc % 2 === 0) {
                out.push(renderEdge(`v,${(gr - 1) / 2},${c}`, 'v'));
            } else {
                const cr = (gr - 1) / 2;
                const cc = (gc - 1) / 2;
                const clue = puzzle.clues[cr][cc];
                const state = clue === null ? '' : SlitherlinkEngine.clueState(puzzle, lines, cr, cc);
                out.push(`<div class="cell ${state} ${isSolved ? 'solved' : ''}">${clue ?? ''}</div>`);
            }
        }
    }
    board.innerHTML = out.join('');
    countersEl.innerText = `${i18n.t('segments')}: ${lines.size}`;
}

function renderEdge(key, orientation) {
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

function dotAt(event) {
    const el = document.elementFromPoint(event.clientX, event.clientY)?.closest('.dot');
    return el ? [Number(el.dataset.r), Number(el.dataset.c)] : null;
}

function edgeBetween(a, b) {
    if (a[0] === b[0] && Math.abs(a[1] - b[1]) === 1) return `h,${a[0]},${Math.min(a[1], b[1])}`;
    if (a[1] === b[1] && Math.abs(a[0] - b[0]) === 1) return `v,${Math.min(a[0], b[0])},${a[1]}`;
    return null;
}

// Tapping an edge cycles it; dragging from dot to dot draws (or erases, if it started on a line)
board.addEventListener('pointerdown', (event) => {
    if (isSolved) return;
    const edge = event.target.closest('.edge');
    if (edge) { event.preventDefault(); cycleEdge(edge.dataset.key); return; }
    const dot = dotAt(event);
    if (!dot) return;
    event.preventDefault();
    drag = { last: dot, mode: null };
    board.setPointerCapture(event.pointerId);
});

board.addEventListener('pointermove', (event) => {
    if (!drag) return;
    const dot = dotAt(event);
    if (!dot || (dot[0] === drag.last[0] && dot[1] === drag.last[1])) return;
    const key = edgeBetween(drag.last, dot);
    if (!key) return;
    if (!drag.mode) drag.mode = lines.has(key) ? 'erase' : 'draw';
    drag.last = dot;
    setLine(key, drag.mode === 'draw');
});

const endDrag = () => { drag = null; };
board.addEventListener('pointerup', endDrag);
board.addEventListener('pointercancel', endDrag);

function checkSolved() {
    if (isSolved || !SlitherlinkEngine.isSolved(puzzle, lines)) return;
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
