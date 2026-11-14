const TILE = JigsawEngine.TILE;
const GAP = 24;          // picture pixels between the frame and the tray

let currentLevelIdx = 0;
let level = null;
let state = null;
let picture = null;      // offscreen canvas with the whole picture
let drag = null;         // { piece, dx, dy } while dragging (offsets in picture px)
let positions = [];      // piece index -> { x, y } in picture px
let isSolved = false;
let statusKey = 'status_play';

const board = document.getElementById('game-board');
const previewEl = document.getElementById('preview');
const statusEl = document.getElementById('status');
const levelInfoEl = document.getElementById('level-info');
const countersEl = document.getElementById('counters');

function loadLevel(idx) {
    level = LevelRegistry[idx];
    if (!level) return;

    currentLevelIdx = idx;
    Progress.setCurrent(idx);
    state = JigsawEngine.create(level);
    isSolved = false;
    drag = null;
    picture = document.createElement('canvas');
    picture.width = level.cols * TILE;
    picture.height = level.rows * TILE;
    JigsawEngine.drawPicture(picture.getContext('2d'), picture.width, picture.height, level.seed);
    previewEl.width = 150;
    previewEl.height = Math.round(150 * picture.height / picture.width);
    previewEl.getContext('2d').drawImage(picture, 0, 0, previewEl.width, previewEl.height);
    setStatus('status_play');
    updateLevelInfo();
    buildBoard();
    layout();
}

// Picture-space geometry of the frame and the tray
function trayRows() { return Math.ceil(state.slots.length / state.cols); }
function totalHeight() { return state.rows * TILE + GAP + trayRows() * TILE; }
function slotPos(slot) { return { x: (slot % state.cols) * TILE, y: Math.floor(slot / state.cols) * TILE }; }
function trayPos(i) { return { x: (i % state.cols) * TILE, y: state.rows * TILE + GAP + Math.floor(i / state.cols) * TILE }; }

function buildBoard() {
    const W = state.cols * TILE;
    const H = totalHeight();
    board.style.aspectRatio = `${W} / ${H}`;
    const pct = (v, total) => `${(v / total) * 100}%`;
    const slots = state.slots.map((_, i) => {
        const p = slotPos(i);
        return `<div class="slot" style="left:${pct(p.x, W)};top:${pct(p.y, H)};width:${pct(TILE, W)};height:${pct(TILE, H)}"></div>`;
    }).join('');
    const frame = `<div class="frame" style="left:0;top:0;width:100%;height:${pct(state.rows * TILE, H)}"></div>`;
    const pieces = state.slots.map((_, i) => `<canvas class="piece" data-piece="${i}" width="${TILE}" height="${TILE}" style="width:${pct(TILE, W)};height:${pct(TILE, H)}"></canvas>`).join('');
    board.innerHTML = frame + slots + pieces;
    board.querySelectorAll('.piece').forEach(el => {
        const i = Number(el.dataset.piece);
        const ctx = el.getContext('2d');
        ctx.drawImage(picture, (i % state.cols) * TILE, Math.floor(i / state.cols) * TILE, TILE, TILE, 0, 0, TILE, TILE);
        ctx.strokeStyle = 'rgba(0,0,0,0.35)';
        ctx.lineWidth = 3;
        ctx.strokeRect(1.5, 1.5, TILE - 3, TILE - 3);
    });
}

// Places every piece at its slot or tray position (except the one being dragged)
function layout() {
    positions = [];
    state.slots.forEach((p, slot) => { if (p !== null) positions[p] = slotPos(slot); });
    state.tray.forEach((p, i) => { positions[p] = trayPos(i); });
    const W = state.cols * TILE;
    const H = totalHeight();
    board.querySelectorAll('.piece').forEach(el => {
        const i = Number(el.dataset.piece);
        if (drag && drag.piece === i) return;
        const pos = positions[i];
        el.style.left = `${(pos.x / W) * 100}%`;
        el.style.top = `${(pos.y / H) * 100}%`;
        el.classList.toggle('locked', JigsawEngine.isLocked(state, i));
        el.classList.toggle('solved', isSolved);
        el.style.zIndex = JigsawEngine.isLocked(state, i) ? 1 : 2;
    });
    const placed = state.slots.filter((p, i) => p === i).length;
    countersEl.innerText = `${i18n.t('placed')}: ${placed}/${state.slots.length}`;
}

function picturePoint(event) {
    const rect = board.getBoundingClientRect();
    return { x: ((event.clientX - rect.left) / rect.width) * state.cols * TILE, y: ((event.clientY - rect.top) / rect.height) * totalHeight() };
}

board.addEventListener('pointerdown', (event) => {
    if (isSolved) return;
    const el = event.target.closest('.piece');
    if (!el) return;
    const piece = Number(el.dataset.piece);
    if (JigsawEngine.isLocked(state, piece)) return;
    event.preventDefault();
    const p = picturePoint(event);
    drag = { piece, dx: p.x - positions[piece].x, dy: p.y - positions[piece].y };
    el.style.zIndex = 10;
    el.classList.add('dragging');
    board.setPointerCapture(event.pointerId);
});

board.addEventListener('pointermove', (event) => {
    if (!drag) return;
    const p = picturePoint(event);
    const el = board.querySelector(`.piece[data-piece="${drag.piece}"]`);
    el.style.left = `${((p.x - drag.dx) / (state.cols * TILE)) * 100}%`;
    el.style.top = `${((p.y - drag.dy) / totalHeight()) * 100}%`;
});

function endDrag(event) {
    if (!drag) return;
    const p = picturePoint(event);
    const x = p.x - drag.dx + TILE / 2;
    const y = p.y - drag.dy + TILE / 2;
    const piece = drag.piece;
    board.querySelector(`.piece[data-piece="${piece}"]`).classList.remove('dragging');
    drag = null;
    dropAt(piece, x, y);
}
board.addEventListener('pointerup', endDrag);
board.addEventListener('pointercancel', endDrag);

// Drops a piece whose center is at picture point (x, y): into the nearest slot if close enough, else back to the tray
window.dropAt = (piece, x, y) => {
    const col = Math.floor(x / TILE);
    const row = Math.floor(y / TILE);
    if (row >= 0 && row < state.rows && col >= 0 && col < state.cols) {
        const slot = row * state.cols + col;
        const center = slotPos(slot);
        if (Math.abs(x - center.x - TILE / 2) < TILE * 0.45 && Math.abs(y - center.y - TILE / 2) < TILE * 0.45 && !JigsawEngine.isLocked(state, state.slots[slot] ?? -1)) {
            JigsawEngine.drop(state, piece, slot);
            layout();
            checkSolved();
            return;
        }
    }
    JigsawEngine.toTray(state, piece);
    layout();
};

function checkSolved() {
    if (!JigsawEngine.isSolved(state)) return;
    isSolved = true;
    setStatus('status_solved');
    Progress.markSolved(currentLevelIdx);
    layout();
    const solvedLevelIdx = currentLevelIdx;
    setTimeout(() => {
        if (solvedLevelIdx === currentLevelIdx) nextLevel();
    }, 2200);
}

window.scatterPieces = () => {
    if (isSolved) return;
    JigsawEngine.scatter(state);
    layout();
};

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
    levelInfoEl.innerText = `${i18n.t('level')} ${currentLevelIdx + 1}/${LevelRegistry.length}: ${level.name} (${level.cols}×${level.rows})`;
}

document.getElementById('restartBtn').onclick = () => loadLevel(currentLevelIdx);

window.addEventListener('langChanged', () => {
    setStatus(statusKey);
    updateLevelInfo();
    layout();
});

// Initial Load
if (LevelRegistry.length > 0) loadLevel(Progress.startLevel());
