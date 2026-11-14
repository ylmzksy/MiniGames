const UNIT = 40;        // screen pixels per lattice unit (SVG units)
const PAD = 1.2;        // lattice units of padding around the target

let currentLevelIdx = 0;
let level = null;
let state = null;
let drag = null;        // { type, k, cell } while a piece is being dragged
let hint = null;        // solution placement shown as an outline
let isSolved = false;
let statusKey = 'status_play';
let bounds = null;

const board = document.getElementById('game-board');
const trayEl = document.getElementById('tray');
const statusEl = document.getElementById('status');
const levelInfoEl = document.getElementById('level-info');
const countersEl = document.getElementById('counters');

function loadLevel(idx) {
    level = LevelRegistry[idx];
    if (!level) return;

    currentLevelIdx = idx;
    Progress.setCurrent(idx);
    state = PatternEngine.create(level);
    drag = null;
    hint = null;
    isSolved = false;
    computeBounds();
    setStatus('status_play');
    updateLevelInfo();
    render();
}

function computeBounds() {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    state.target.forEach(key => {
        PatternEngine.vertices(key.split(',').map(Number)).forEach(([x, y]) => {
            minX = Math.min(minX, x); maxX = Math.max(maxX, x);
            minY = Math.min(minY, y); maxY = Math.max(maxY, y);
        });
    });
    bounds = { minX: minX - PAD, minY: minY - PAD, width: maxX - minX + 2 * PAD, height: maxY - minY + 2 * PAD };
}

const sx = x => ((x - bounds.minX) * UNIT).toFixed(1);
const sy = y => ((y - bounds.minY) * UNIT).toFixed(1);
const poly = cell => PatternEngine.vertices(cell).map(([x, y]) => `${sx(x)},${sy(y)}`).join(' ');

function render() {
    const target = [...state.target].map(key => `<polygon class="target" points="${poly(key.split(',').map(Number))}"></polygon>`).join('');
    const placed = state.placed.map((p, i) => `<g class="piece ${isSolved ? 'solved' : ''}" data-index="${i}" style="--c:${PatternEngine.pieces[p.type].color}">${p.cells.map(c => `<polygon points="${poly(c)}"></polygon>`).join('')}</g>`).join('');
    const hintHtml = hint ? `<g class="hint">${PatternEngine.cells(...hint).map(c => `<polygon points="${poly(c)}"></polygon>`).join('')}</g>` : '';
    const ghost = drag && drag.cell ? `<g class="ghost ${PatternEngine.canPlace(state, drag.type, drag.cell[0], drag.cell[1], drag.k) ? 'ok' : 'bad'}" style="--c:${PatternEngine.pieces[drag.type].color}">${PatternEngine.cells(drag.type, drag.cell[0], drag.cell[1], drag.k).map(c => `<polygon points="${poly(c)}"></polygon>`).join('')}</g>` : '';
    board.innerHTML = `<svg viewBox="0 0 ${(bounds.width * UNIT).toFixed(1)} ${(bounds.height * UNIT).toFixed(1)}" role="img">${target}${hintHtml}${placed}${ghost}</svg>`;
    board.style.maxWidth = `${Math.min(560, bounds.width * UNIT * 1.2)}px`;

    trayEl.innerHTML = Object.keys(PatternEngine.pieces).map(type => {
        const count = state.tray[type] || 0;
        const cells = PatternEngine.cells(type, 0, 0, 0);
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        cells.forEach(c => PatternEngine.vertices(c).forEach(([x, y]) => { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }));
        const pts = c => PatternEngine.vertices(c).map(([x, y]) => `${((x - minX + 0.15) * 28).toFixed(1)},${((y - minY + 0.15) * 28).toFixed(1)}`).join(' ');
        return `<div class="tray-piece ${count ? '' : 'empty'} ${drag && drag.type === type ? 'active' : ''}" data-type="${type}">
            <svg viewBox="0 0 ${((maxX - minX + 0.3) * 28).toFixed(1)} ${((maxY - minY + 0.3) * 28).toFixed(1)}" style="--c:${PatternEngine.pieces[type].color}">${cells.map(c => `<polygon points="${pts(c)}"></polygon>`).join('')}</svg>
            <span class="count">×${count}</span>
        </div>`;
    }).join('');
    countersEl.innerText = `${i18n.t('covered')}: ${PatternEngine.covered(state).size}/${state.target.size}`;
}

// Lattice triangle under a pointer event, or null outside the board
function cellAt(event) {
    const svg = board.querySelector('svg');
    const rect = svg.getBoundingClientRect();
    const px = ((event.clientX - rect.left) / rect.width) * bounds.width + bounds.minX;
    const py = ((event.clientY - rect.top) / rect.height) * bounds.height + bounds.minY;
    const [u, v] = PatternEngine.basis(px, py);
    return PatternEngine.triangleAt(u, v);
}

// Pressing a tray piece starts a drag; the piece's anchor follows the lattice cell under the pointer
trayEl.addEventListener('pointerdown', (event) => {
    if (isSolved) return;
    const el = event.target.closest('.tray-piece');
    if (!el || !state.tray[el.dataset.type]) return;
    event.preventDefault();
    drag = { type: el.dataset.type, k: drag && drag.type === el.dataset.type ? drag.k : 0, cell: null };
    trayEl.setPointerCapture(event.pointerId);
    render();
});

function moveDrag(event) {
    if (!drag) return;
    const rect = board.querySelector('svg').getBoundingClientRect();
    const inside = event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
    drag.cell = inside ? anchorFor(cellAt(event)) : null;
    render();
}

// The piece is anchored on the up triangle of the hovered rhombus cell
function anchorFor(cell) {
    return [cell[0], cell[1]];
}

function endDrag() {
    if (!drag) return;
    if (drag.cell) tryPlace(drag.type, drag.cell[0], drag.cell[1], drag.k);
    drag = null;
    render();
}
trayEl.addEventListener('pointermove', moveDrag);
trayEl.addEventListener('pointerup', endDrag);
trayEl.addEventListener('pointercancel', endDrag);

window.tryPlace = (type, x, y, k) => {
    if (isSolved) return false;
    if (!PatternEngine.place(state, type, x, y, k)) { setStatus('status_no_fit'); render(); return false; }
    hint = null;
    if (statusKey === 'status_no_fit') setStatus('status_play');
    render();
    checkSolved();
    return true;
};

// Tapping a placed piece lifts it back into the tray
board.addEventListener('pointerdown', (event) => {
    if (isSolved || drag) return;
    const g = event.target.closest('.piece');
    if (!g) return;
    event.preventDefault();
    PatternEngine.lift(state, Number(g.dataset.index));
    hint = null;
    render();
});

window.rotateDrag = () => {
    if (!drag) return;
    drag.k = (drag.k + 1) % 6;
    render();
};

window.showHint = () => {
    if (isSolved) return;
    const covered = PatternEngine.covered(state);
    // a solution placement whose triangles are all still free
    const open = level.solution.find(p => PatternEngine.cells(...p).every(c => !covered.has(PatternEngine.key(c))) && state.tray[p[0]] > 0);
    hint = open || null;
    if (!hint) setStatus('status_no_hint');
    render();
};

function checkSolved() {
    if (!PatternEngine.isSolved(state)) return;
    isSolved = true;
    hint = null;
    setStatus('status_solved');
    Progress.markSolved(currentLevelIdx);
    render();
    const solvedLevelIdx = currentLevelIdx;
    setTimeout(() => {
        if (solvedLevelIdx === currentLevelIdx) nextLevel();
    }, 2000);
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
    if (document.querySelector('.modal.active')) return;
    if (event.key.toLowerCase() === 'r') { rotateDrag(); event.preventDefault(); }
    if (event.key.toLowerCase() === 'h') { showHint(); event.preventDefault(); }
});

document.getElementById('restartBtn').onclick = () => loadLevel(currentLevelIdx);

window.addEventListener('langChanged', () => {
    setStatus(statusKey);
    updateLevelInfo();
    render();
});

// Initial Load
if (LevelRegistry.length > 0) loadLevel(Progress.startLevel());
