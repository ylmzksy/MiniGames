/**
 * Waypoints page: drag from checkpoint 1 to draw the trail. Drag back over the
 * trail to shorten it, or press on any trail cell to continue from there.
 * Arrow keys move the end of the trail one cell (back onto the previous cell
 * undoes a step).
 */
let currentLevelIdx = 0;
let puzzle = null;
let trail = [];
let history = [];
let solved = false;
let statusKey = 'status_play';
let startTime = 0;
let elapsed = 0;
let timer = null;

const board = document.getElementById('game-board');
const statusEl = document.getElementById('status');
const levelInfoEl = document.getElementById('level-info');
const countersEl = document.getElementById('counters');

function loadLevel(idx) {
    const level = LevelRegistry[idx];
    if (!level) return;
    currentLevelIdx = idx;
    Progress.setCurrent(idx);
    puzzle = WaypointsEngine.parse(level);
    trail = [];
    history = [];
    solved = false;
    stopTimer();
    elapsed = 0;
    setStatus('status_play');
    updateLevelInfo();
    buildBoard();
    render();
}

/* ---------- Timer ---------- */

function startTimer() {
    if (timer || solved) return;
    startTime = Date.now() - elapsed;
    timer = setInterval(() => { elapsed = Date.now() - startTime; renderCounters(); }, 500);
}

function stopTimer() {
    clearInterval(timer);
    timer = null;
}

function formatTime(ms) {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/* ---------- Board ---------- */

function buildBoard() {
    const { width, height } = puzzle;
    board.style.gridTemplateColumns = `repeat(${width}, 1fr)`;
    board.style.aspectRatio = `${width} / ${height}`;
    const cells = [];
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const walls = [
                x < width - 1 && puzzle.walls.has(WaypointsEngine.wallKey(x, y, x + 1, y)) ? 'wall-r' : '',
                y < height - 1 && puzzle.walls.has(WaypointsEngine.wallKey(x, y, x, y + 1)) ? 'wall-b' : ''
            ].join(' ');
            const number = puzzle.checkAt.get(WaypointsEngine.key(x, y));
            const mark = number ? `<span class="checkpoint ${number === 1 ? 'first' : ''} ${number === puzzle.checkpoints.length ? 'last' : ''}">${number}</span>` : '';
            cells.push(`<div class="cell ${walls}" data-x="${x}" data-y="${y}">${mark}</div>`);
        }
    }
    board.innerHTML = `${cells.join('')}<svg class="trail" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none"><polyline/><circle r="0.16"/></svg>`;
}

function render() {
    const onTrail = new Set(trail.map(([x, y]) => WaypointsEngine.key(x, y)));
    board.querySelectorAll('.cell').forEach(cell => {
        const key = WaypointsEngine.key(Number(cell.dataset.x), Number(cell.dataset.y));
        cell.classList.toggle('visited', onTrail.has(key));
    });
    const points = trail.map(([x, y]) => `${x + 0.5},${y + 0.5}`).join(' ');
    board.querySelector('.trail polyline').setAttribute('points', points);
    const head = board.querySelector('.trail circle');
    head.style.display = trail.length ? '' : 'none';
    if (trail.length) {
        const [x, y] = trail[trail.length - 1];
        head.setAttribute('cx', x + 0.5);
        head.setAttribute('cy', y + 0.5);
    }
    board.classList.toggle('solved', solved);
    document.getElementById('undoBtn').disabled = solved || !history.length;
    renderCounters();
}

function renderCounters() {
    const total = puzzle.width * puzzle.height;
    const next = Math.min(WaypointsEngine.nextCheckpoint(puzzle, trail), puzzle.checkpoints.length);
    countersEl.innerText = `${i18n.t('cells')}: ${trail.length}/${total} · ${i18n.t('next')}: ${next} · ${formatTime(elapsed)}`;
}

/* ---------- Moving the trail ---------- */

// Moves the end of the trail to `cell`: back along the trail, or forward one step
function stepTo(cell) {
    const at = WaypointsEngine.indexOf(trail, cell);
    if (at >= 0) {
        if (at === trail.length - 1) return null;
        trail.length = at + 1;
        return null;
    }
    return WaypointsEngine.extend(puzzle, trail, cell);
}

// Walks from the trail's end towards a cell the pointer jumped to, one step at a time
function walkTo(cell) {
    for (let guard = 0; guard < 64; guard++) {
        const head = trail[trail.length - 1];
        if (!head) return stepTo(cell);
        if (head[0] === cell[0] && head[1] === cell[1]) return null;
        const dx = cell[0] - head[0];
        const dy = cell[1] - head[1];
        const next = Math.abs(dx) >= Math.abs(dy)
            ? [head[0] + Math.sign(dx), head[1]]
            : [head[0], head[1] + Math.sign(dy)];
        const problem = stepTo(next);
        if (problem) return problem;
    }
    return null;
}

function afterChange(problem) {
    if (WaypointsEngine.isSolved(puzzle, trail)) {
        solved = true;
        stopTimer();
        setStatus('status_solved', { time: formatTime(elapsed) });
        Progress.markSolved(currentLevelIdx);
        render();
        const id = currentLevelIdx;
        setTimeout(() => { if (id === currentLevelIdx) nextLevel(); }, 2200);
        return;
    }
    if (problem === 'order') setStatus('status_order', { n: WaypointsEngine.nextCheckpoint(puzzle, trail) });
    else if (trail.length === puzzle.width * puzzle.height) setStatus('status_end');
    else if (isAtLast() && trail.length < puzzle.width * puzzle.height) setStatus('status_cover');
    else setStatus('status_play');
    render();
}

function isAtLast() {
    const last = puzzle.checkpoints[puzzle.checkpoints.length - 1];
    const end = trail[trail.length - 1];
    return end && end[0] === last[0] && end[1] === last[1];
}

function remember() {
    history.push(trail.map(c => [...c]));
    if (history.length > 200) history.shift();
}

/* ---------- Pointer ---------- */

let dragging = false;

function cellFromPoint(clientX, clientY) {
    const el = document.elementFromPoint(clientX, clientY)?.closest('.cell');
    if (!el || !board.contains(el)) return null;
    return [Number(el.dataset.x), Number(el.dataset.y)];
}

board.addEventListener('pointerdown', (e) => {
    if (solved) return;
    const cell = cellFromPoint(e.clientX, e.clientY);
    if (!cell) return;
    const onTrail = WaypointsEngine.indexOf(trail, cell) >= 0;
    const isStart = puzzle.checkAt.get(WaypointsEngine.key(...cell)) === 1;
    const head = trail[trail.length - 1];
    const nextToHead = head && WaypointsEngine.canStep(puzzle, head, cell);
    if (!onTrail && !isStart && !nextToHead) {
        setStatus(trail.length ? 'status_from_end' : 'status_start');
        return;
    }
    remember();
    startTimer();
    if (isStart && !onTrail) trail = [];
    dragging = true;
    board.setPointerCapture(e.pointerId);
    afterChange(stepTo(cell));
});

board.addEventListener('pointermove', (e) => {
    if (!dragging || solved) return;
    const cell = cellFromPoint(e.clientX, e.clientY);
    if (!cell) return;
    const head = trail[trail.length - 1];
    if (head && head[0] === cell[0] && head[1] === cell[1]) return;
    afterChange(walkTo(cell));
});

const endDrag = () => {
    if (!dragging) return;
    dragging = false;
    // A press that changed nothing shouldn't take an undo step
    const before = history[history.length - 1];
    if (before && before.length === trail.length && before.every((c, i) => c[0] === trail[i][0] && c[1] === trail[i][1])) history.pop();
    render();
};
board.addEventListener('pointerup', endDrag);
board.addEventListener('pointercancel', endDrag);

/* ---------- Keyboard ---------- */

document.addEventListener('keydown', (event) => {
    const inFormControl = event.target instanceof Element && event.target.closest('select, input');
    if (inFormControl || document.querySelector('.modal.active') || !puzzle || solved) return;
    const dirs = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
    if (event.key === 'z' || event.key === 'Backspace') {
        undo();
    } else if (dirs[event.key]) {
        remember();
        startTimer();
        if (!trail.length) {
            afterChange(stepTo(puzzle.checkpoints[0]));
        } else {
            const head = trail[trail.length - 1];
            const [dx, dy] = dirs[event.key];
            afterChange(stepTo([head[0] + dx, head[1] + dy]));
        }
    } else {
        return;
    }
    event.preventDefault();
});

/* ---------- Buttons ---------- */

function undo() {
    if (solved || !history.length) return;
    trail = history.pop();
    afterChange(null);
}

document.getElementById('undoBtn').onclick = undo;
document.getElementById('clearBtn').onclick = () => {
    if (solved || !trail.length) return;
    remember();
    trail = [];
    afterChange(null);
};
document.getElementById('restartBtn').onclick = () => loadLevel(currentLevelIdx);

function nextLevel() {
    if (currentLevelIdx + 1 < LevelRegistry.length) loadLevel(currentLevelIdx + 1);
    else setStatus('all_levels_cleared');
}

/* ---------- Status ---------- */

let statusParams = {};
function setStatus(key, params = {}) {
    statusKey = key;
    statusParams = params;
    statusEl.innerText = i18n.t(key, params);
}

function updateLevelInfo() {
    const level = LevelRegistry[currentLevelIdx];
    levelInfoEl.innerText = `${i18n.t('level')} ${currentLevelIdx + 1}/${LevelRegistry.length}: ${level.name}`;
}

window.addEventListener('langChanged', () => {
    setStatus(statusKey, statusParams);
    updateLevelInfo();
    render();
});

if (LevelRegistry.length > 0) loadLevel(Progress.startLevel());
