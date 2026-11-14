const E = PentominoEngine;
const PALETTE = ['#e03b3b', '#3b6fe0', '#1f9d55', '#f5b301', '#9b4ddb', '#ff8c1a', '#17b8c8', '#f06ab0', '#8a94a6', '#7fd36b', '#b08968', '#6fb4ff'];
const DRAG_START = 6; // px of movement before a press becomes a drag

let currentLevelIdx = 0;
let level = null;
let state = null;
let selected = null;   // piece index chosen in the tray
let drag = null;       // { idx, grab: [r, c], startX, startY, active, ghost, fromBoard }
let moves = 0;
let isSolved = false;
let statusKey = 'status_play';

const board = document.getElementById('game-board');
const trayEl = document.getElementById('tray');
const statusEl = document.getElementById('status');
const levelInfoEl = document.getElementById('level-info');
const countersEl = document.getElementById('counters');
const hintBtn = document.getElementById('hintBtn');

// Pieces come from the level's pentomino letters; the solution lists where each letter goes
function levelPieces(lvl) {
    return lvl.pieces.map(name => ({ name, cells: PentominoEngine.SHAPES[name] }));
}

function solutionFor(idx) {
    const entry = level.solution?.find(s => s.piece === state.pieces[idx].name);
    return entry ? entry.cells : null;
}

function loadLevel(idx) {
    level = LevelRegistry[idx];
    if (!level) return;

    currentLevelIdx = idx;
    Progress.setCurrent(idx);
    state = E.parse(level, levelPieces(level));
    selected = null;
    drag = null;
    moves = 0;
    isSolved = false;
    setStatus('status_play');
    updateLevelInfo();
    render();
}

function colorOf(idx) {
    return PALETTE[idx % PALETTE.length];
}

function render(preview = null) {
    board.style.gridTemplateColumns = `repeat(${state.width}, 1fr)`;
    board.style.maxWidth = `${state.width * 48}px`;
    const owner = new Map();
    state.placed.forEach((p, i) => { if (p) p.cells.forEach(([r, c]) => owner.set(`${p.r + r},${p.c + c}`, i)); });
    const previewCells = new Map();
    if (preview) preview.cells.forEach(([r, c]) => previewCells.set(`${preview.r + r},${preview.c + c}`, preview.ok));

    const cells = [];
    for (let r = 0; r < state.height; r++) {
        for (let c = 0; c < state.width; c++) {
            const key = `${r},${c}`;
            const inRegion = state.region.has(key);
            const idx = owner.get(key);
            const classes = ['cell', inRegion ? 'region' : 'void', idx !== undefined ? 'piece' : '',
                previewCells.has(key) ? (previewCells.get(key) ? 'ok' : 'bad') : '', isSolved ? 'solved' : ''].join(' ');
            const style = idx !== undefined ? `style="--piece:${colorOf(idx)}"` : '';
            cells.push(`<div class="${classes}" data-r="${r}" data-c="${c}" ${idx !== undefined ? `data-idx="${idx}"` : ''} ${style}></div>`);
        }
    }
    board.innerHTML = cells.join('');

    trayEl.innerHTML = state.pieces.map((p, i) => {
        if (state.placed[i] || (drag && drag.idx === i && drag.active)) return '';
        const shape = state.shapes[i];
        const h = Math.max(...shape.map(c => c[0])) + 1;
        const w = Math.max(...shape.map(c => c[1])) + 1;
        const mini = shape.map(([r, c]) => `<i style="grid-row:${r + 1};grid-column:${c + 1}"></i>`).join('');
        return `<div class="tray-piece ${i === selected ? 'selected' : ''}" data-idx="${i}" style="--piece:${colorOf(i)};grid-template-rows:repeat(${h},1fr);grid-template-columns:repeat(${w},1fr);width:${w * 18}px;height:${h * 18}px" title="${p.name}">${mini}</div>`;
    }).join('');

    const placedCount = state.placed.filter(Boolean).length;
    countersEl.innerText = `${i18n.t('placed')}: ${placedCount}/${state.pieces.length} · ${i18n.t('moves')}: ${moves}`;
    if (hintBtn) hintBtn.disabled = isSolved;
}

function cellSize() {
    return board.getBoundingClientRect().width / state.width;
}

function boardCellAt(x, y) {
    const rect = board.getBoundingClientRect();
    const size = cellSize();
    const c = Math.floor((x - rect.left) / size);
    const r = Math.floor((y - rect.top) / size);
    return [r, c];
}

// ---------- actions (also used by the tests) ----------
window.selectPiece = (idx) => {
    if (isSolved) return;
    selected = selected === idx ? null : idx;
    setStatus(selected === null ? 'status_play' : 'status_pick');
    render();
};

function currentShapeTarget() {
    return drag && drag.active ? drag.idx : selected;
}

window.rotateSelected = () => {
    const idx = currentShapeTarget();
    if (idx === null || isSolved) return;
    const res = E.rotate(state.shapes[idx], drag && drag.active ? drag.grab : null);
    state.shapes[idx] = res.cells;
    if (drag && drag.active) { drag.grab = res.track; buildGhost(); }
    render();
};

window.flipSelected = () => {
    const idx = currentShapeTarget();
    if (idx === null || isSolved) return;
    const res = E.flip(state.shapes[idx], drag && drag.active ? drag.grab : null);
    state.shapes[idx] = res.cells;
    if (drag && drag.active) { drag.grab = res.track; buildGhost(); }
    render();
};

// Places the piece so that its first cell (or, failing that, its top-left corner) lands on (r, c)
window.tapCell = (r, c) => {
    if (isSolved) return;
    const idx = selected;
    if (idx === null || state.placed[idx]) return;
    const shape = state.shapes[idx];
    const anchors = [shape[0], [0, 0]];
    for (const [ar, ac] of anchors) {
        if (placePiece(idx, shape, r - ar, c - ac)) return;
    }
    setStatus('status_nofit');
};

window.placePiece = (idx, cells, r, c) => {
    if (isSolved || !E.place(state, idx, cells, r, c)) return false;
    moves++;
    selected = null;
    setStatus('status_play');
    render();
    checkSolved();
    return true;
};

window.liftPiece = (idx) => {
    if (isSolved || !state.placed[idx]) return;
    E.lift(state, idx);
    selected = idx;
    moves++;
    setStatus('status_pick');
    render();
};

window.hint = () => {
    if (isSolved) return;
    for (let i = 0; i < state.pieces.length; i++) {
        const target = solutionFor(i);
        if (!target) continue;
        const cells = E.normalize(target);
        const r = Math.min(...target.map(x => x[0]));
        const c = Math.min(...target.map(x => x[1]));
        const p = state.placed[i];
        if (p && p.r === r && p.c === c && E.key(p.cells) === E.key(cells)) continue;
        // clear whatever is in the way, then put this piece where it belongs
        if (p) E.lift(state, i);
        const taken = new Map();
        state.placed.forEach((q, j) => { if (q) q.cells.forEach(([dr, dc]) => taken.set(`${q.r + dr},${q.c + dc}`, j)); });
        cells.forEach(([dr, dc]) => { const j = taken.get(`${r + dr},${c + dc}`); if (j !== undefined) E.lift(state, j); });
        E.place(state, i, cells, r, c);
        moves++;
        selected = null;
        setStatus('status_hint');
        render();
        checkSolved();
        return;
    }
};

// ---------- dragging ----------
function buildGhost() {
    if (!drag || !drag.active) return;
    if (drag.ghost) drag.ghost.remove();
    const size = cellSize();
    const ghost = document.createElement('div');
    ghost.className = 'ghost';
    ghost.style.setProperty('--piece', colorOf(drag.idx));
    state.shapes[drag.idx].forEach(([r, c]) => {
        const el = document.createElement('i');
        el.style.left = `${c * size}px`;
        el.style.top = `${r * size}px`;
        el.style.width = `${size}px`;
        el.style.height = `${size}px`;
        ghost.appendChild(el);
    });
    document.body.appendChild(ghost);
    drag.ghost = ghost;
    moveGhost(drag.x, drag.y);
}

function moveGhost(x, y) {
    if (!drag || !drag.ghost) return;
    const size = cellSize();
    drag.ghost.style.left = `${x - (drag.grab[1] + 0.5) * size}px`;
    drag.ghost.style.top = `${y - (drag.grab[0] + 0.5) * size}px`;
}

function startPress(event, idx, grab, fromBoard) {
    drag = { idx, grab, startX: event.clientX, startY: event.clientY, x: event.clientX, y: event.clientY, active: false, ghost: null, fromBoard };
}

document.addEventListener('pointerdown', (event) => {
    if (isSolved) return;
    const trayPiece = event.target.closest('.tray-piece');
    if (trayPiece) {
        event.preventDefault();
        const idx = Number(trayPiece.dataset.idx);
        const rect = trayPiece.getBoundingClientRect();
        const shape = state.shapes[idx];
        const w = Math.max(...shape.map(c => c[1])) + 1;
        const h = Math.max(...shape.map(c => c[0])) + 1;
        let gc = Math.floor((event.clientX - rect.left) / (rect.width / w));
        let gr = Math.floor((event.clientY - rect.top) / (rect.height / h));
        // grab the nearest cell of the shape
        const grab = shape.reduce((best, cell) => Math.abs(cell[0] - gr) + Math.abs(cell[1] - gc) < Math.abs(best[0] - gr) + Math.abs(best[1] - gc) ? cell : best, shape[0]);
        startPress(event, idx, [...grab], false);
        return;
    }
    const cell = event.target.closest('#game-board .cell');
    if (cell && cell.dataset.idx !== undefined) {
        event.preventDefault();
        const idx = Number(cell.dataset.idx);
        const p = state.placed[idx];
        startPress(event, idx, [Number(cell.dataset.r) - p.r, Number(cell.dataset.c) - p.c], true);
    }
});

document.addEventListener('pointermove', (event) => {
    if (!drag) return;
    drag.x = event.clientX;
    drag.y = event.clientY;
    if (!drag.active) {
        if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < DRAG_START) return;
        drag.active = true;
        if (drag.fromBoard) { E.lift(state, drag.idx); moves++; }
        selected = null;
        render();
        buildGhost();
    }
    moveGhost(event.clientX, event.clientY);
    const [r, c] = boardCellAt(event.clientX, event.clientY);
    const anchor = [r - drag.grab[0], c - drag.grab[1]];
    const cells = state.shapes[drag.idx];
    render({ cells, r: anchor[0], c: anchor[1], ok: E.canPlace(state, drag.idx, cells, anchor[0], anchor[1]) });
});

function endPress(event) {
    if (!drag) return;
    const d = drag;
    drag = null;
    if (d.ghost) d.ghost.remove();
    if (!d.active) {
        // a plain tap: select a tray piece, or lift a placed piece
        if (d.fromBoard) liftPiece(d.idx); else selectPiece(d.idx);
        return;
    }
    const [r, c] = boardCellAt(event.clientX, event.clientY);
    const cells = state.shapes[d.idx];
    if (!placePiece(d.idx, cells, r - d.grab[0], c - d.grab[1])) {
        setStatus('status_nofit');
        render();
    }
}
document.addEventListener('pointerup', endPress);
document.addEventListener('pointercancel', () => { if (drag?.ghost) drag.ghost.remove(); drag = null; render(); });

// Tapping an empty region cell places the selected tray piece there
board.addEventListener('click', (event) => {
    const cell = event.target.closest('.cell');
    if (!cell || cell.dataset.idx !== undefined || selected === null) return;
    tapCell(Number(cell.dataset.r), Number(cell.dataset.c));
});

function checkSolved() {
    if (isSolved || !E.isSolved(state)) return;
    isSolved = true;
    selected = null;
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
    levelInfoEl.innerText = `${i18n.t('level')} ${currentLevelIdx + 1}/${LevelRegistry.length}: ${level.name}`;
}

document.addEventListener('keydown', (event) => {
    const inFormControl = event.target instanceof Element && event.target.closest('select, input');
    if (inFormControl || document.querySelector('.modal.active')) return;
    const k = event.key.toLowerCase();
    if (k === 'r') rotateSelected();
    else if (k === 'f') flipSelected();
    else if (k === 'escape') { selected = null; render(); }
    else return;
    event.preventDefault();
});

document.getElementById('rotateBtn').onclick = () => rotateSelected();
document.getElementById('flipBtn').onclick = () => flipSelected();
if (hintBtn) hintBtn.onclick = () => hint();
document.getElementById('restartBtn').onclick = () => loadLevel(currentLevelIdx);

window.addEventListener('langChanged', () => {
    setStatus(statusKey);
    updateLevelInfo();
    render();
});

// Initial Load
if (LevelRegistry.length > 0) loadLevel(Progress.startLevel());
