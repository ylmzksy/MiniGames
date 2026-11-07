let currentLevelIdx = 0;
let puzzle = null;
let state = null;
let selectedGalaxy = null;
let drag = null;        // { mode: 'assign' | 'clear' }
let isSolved = false;
let statusKey = 'status_pick';

const board = document.getElementById('game-board');
const statusEl = document.getElementById('status');
const levelInfoEl = document.getElementById('level-info');
const countersEl = document.getElementById('counters');

function loadLevel(idx) {
    const level = LevelRegistry[idx];
    if (!level) return;

    currentLevelIdx = idx;
    Progress.setCurrent(idx);
    puzzle = GalaxiesEngine.parse(level);
    state = GalaxiesEngine.create(puzzle);
    selectedGalaxy = null;
    drag = null;
    isSolved = false;
    setStatus('status_pick');
    updateLevelInfo();
    render();
}

function colorOf(g) {
    return `hsl(${(g * 47) % 360} 65% 82%)`;
}

function render() {
    const { width, height } = puzzle;
    board.style.setProperty('--cols', width);
    board.style.maxWidth = `${width * 52}px`;
    const states = puzzle.centers.map((_, g) => GalaxiesEngine.galaxyState(puzzle, state, g));

    const cells = [];
    for (let r = 0; r < height; r++) {
        for (let c = 0; c < width; c++) {
            const g = state.owner[r][c];
            const borders = ['top', 'bottom', 'left', 'right'].filter(side => {
                const [dr, dc] = { top: [-1, 0], bottom: [1, 0], left: [0, -1], right: [0, 1] }[side];
                const nr = r + dr;
                const nc = c + dc;
                return GalaxiesEngine.inside(puzzle, nr, nc) && state.owner[nr][nc] !== g;
            }).map(side => `wall-${side}`);
            const classes = ['cell', g === null ? 'empty' : '', ...borders, g !== null && states[g] === 'bad' ? 'bad' : '',
                g !== null && g === selectedGalaxy ? 'mine' : '', isSolved ? 'solved' : ''].join(' ');
            const style = g === null ? '' : `style="--galaxy:${colorOf(g)}"`;
            cells.push(`<div class="${classes}" ${style} data-r="${r}" data-c="${c}"></div>`);
        }
    }
    const dots = puzzle.centers.map(([y, x], g) =>
        `<div class="dot ${g === selectedGalaxy ? 'selected' : ''} ${states[g] === 'bad' ? 'bad' : ''}" style="left:${(x / (2 * width)) * 100}%;top:${(y / (2 * height)) * 100}%" data-g="${g}"></div>`
    ).join('');
    board.innerHTML = `<div class="cells">${cells.join('')}</div>${dots}`;
    countersEl.innerText = `${i18n.t('assigned')}: ${GalaxiesEngine.assignedCount(state)}/${width * height}`;
}

function cellAt(event) {
    const el = document.elementFromPoint(event.clientX, event.clientY)?.closest('.cell');
    return el ? [Number(el.dataset.r), Number(el.dataset.c)] : null;
}

function applyAt(r, c) {
    if (selectedGalaxy === null) return;
    if (drag.mode === 'clear') {
        if (state.owner[r][c] === selectedGalaxy) GalaxiesEngine.clear(puzzle, state, r, c);
    } else if (!GalaxiesEngine.assign(puzzle, state, selectedGalaxy, r, c)) {
        setStatus('status_no_mirror');
    }
    render();
}

// Tap a dot to choose its galaxy; then tap or drag over cells to assign them (with their mirrors)
board.addEventListener('pointerdown', (event) => {
    if (isSolved) return;
    const dot = event.target.closest('.dot');
    if (dot) {
        event.preventDefault();
        selectedGalaxy = Number(dot.dataset.g);
        setStatus('status_paint');
        render();
        return;
    }
    const cell = cellAt(event);
    if (!cell) return;
    event.preventDefault();
    const [r, c] = cell;
    if (selectedGalaxy === null) {
        if (state.owner[r][c] !== null) { selectedGalaxy = state.owner[r][c]; setStatus('status_paint'); render(); }
        return;
    }
    const own = state.owner[r][c] === selectedGalaxy && !state.fixed.has(`${r},${c}`);
    drag = { mode: own ? 'clear' : 'assign' };
    if (statusKey === 'status_no_mirror') setStatus('status_paint');
    applyAt(r, c);
    board.setPointerCapture(event.pointerId);
});

board.addEventListener('pointermove', (event) => {
    if (!drag) return;
    const cell = cellAt(event);
    if (!cell) return;
    const [r, c] = cell;
    if (drag.mode === 'assign' && state.owner[r][c] === selectedGalaxy) return;
    if (drag.mode === 'clear' && state.owner[r][c] !== selectedGalaxy) return;
    applyAt(r, c);
});

const endDrag = () => { if (!drag) return; drag = null; checkSolved(); };
board.addEventListener('pointerup', endDrag);
board.addEventListener('pointercancel', endDrag);

function checkSolved() {
    if (isSolved || !GalaxiesEngine.isSolved(puzzle, state)) return;
    isSolved = true;
    selectedGalaxy = null;
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
