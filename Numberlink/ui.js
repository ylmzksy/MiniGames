const PALETTE = ['#e03b3b', '#3b6fe0', '#1f9d55', '#f5b301', '#9b4ddb', '#ff8c1a', '#17b8c8', '#f06ab0', '#8a94a6', '#7fd36b', '#b08968', '#6fb4ff'];

let currentLevelIdx = 0;
let puzzle = null;
let paths = new Map(); // symbol -> ordered cells of its path
let drag = null;       // symbol being drawn, or null
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
    puzzle = NumberlinkEngine.parse(level);
    paths = new Map(puzzle.symbols.map(sym => [sym, [puzzle.ends.get(sym)[0]]]));
    drag = null;
    isSolved = false;
    setStatus('status_play');
    updateLevelInfo();
    render();
}

function colorOf(sym) {
    return PALETTE[puzzle.symbols.indexOf(sym) % PALETTE.length];
}

function render() {
    const { width, height } = puzzle;
    board.style.gridTemplateColumns = `repeat(${width}, 1fr)`;
    board.style.maxWidth = `${width * 56}px`;

    // Stub directions per cell, from the path order
    const stubs = new Map();
    paths.forEach(path => path.forEach((cell, i) => {
        const key = `${cell[0]},${cell[1]}`;
        [path[i - 1], path[i + 1]].forEach(other => {
            if (!other) return;
            const dir = other[0] < cell[0] ? 'up' : other[0] > cell[0] ? 'down' : other[1] < cell[1] ? 'left' : 'right';
            (stubs.get(key) || stubs.set(key, []).get(key)).push(dir);
        });
    }));

    const cells = [];
    for (let r = 0; r < height; r++) {
        for (let c = 0; c < width; c++) {
            const endpoint = NumberlinkEngine.endpointSymbol(puzzle, r, c);
            const owner = NumberlinkEngine.owner(paths, r, c);
            const sym = owner?.sym ?? endpoint;
            const color = sym ? colorOf(sym) : 'transparent';
            const stubHtml = (stubs.get(`${r},${c}`) || []).map(d => `<i class="stub ${d}"></i>`).join('');
            const classes = ['cell', owner ? 'on-path' : '', endpoint ? 'endpoint' : '',
                endpoint && NumberlinkEngine.isComplete(puzzle, paths, endpoint) ? 'done' : '', isSolved ? 'solved' : ''].join(' ');
            cells.push(`<div class="${classes}" data-r="${r}" data-c="${c}" style="--flow:${color}">${stubHtml}${endpoint ? '<span class="pin"></span>' : ''}</div>`);
        }
    }
    board.innerHTML = cells.join('');

    const done = puzzle.symbols.filter(sym => NumberlinkEngine.isComplete(puzzle, paths, sym)).length;
    const filled = Math.round((NumberlinkEngine.covered(paths) / (width * height)) * 100);
    countersEl.innerText = `${i18n.t('flows')}: ${done}/${puzzle.symbols.length} · ${i18n.t('filled')}: ${filled}%`;
}

function cellAt(event) {
    const el = document.elementFromPoint(event.clientX, event.clientY)?.closest('.cell');
    return el ? [Number(el.dataset.r), Number(el.dataset.c)] : null;
}

// Touching an endpoint starts its path afresh; touching a path cell cuts the path back to it
board.addEventListener('pointerdown', (event) => {
    if (isSolved) return;
    const cell = cellAt(event);
    if (!cell) return;
    event.preventDefault();
    const [r, c] = cell;
    const endpoint = NumberlinkEngine.endpointSymbol(puzzle, r, c);
    const owner = NumberlinkEngine.owner(paths, r, c);
    if (endpoint) {
        paths.set(endpoint, [[r, c]]);
        drag = endpoint;
    } else if (owner) {
        paths.set(owner.sym, paths.get(owner.sym).slice(0, owner.index + 1));
        drag = owner.sym;
    } else {
        return;
    }
    board.setPointerCapture(event.pointerId);
    render();
});

board.addEventListener('pointermove', (event) => {
    if (!drag) return;
    const cell = cellAt(event);
    if (!cell) return;
    const path = paths.get(drag);
    const last = path[path.length - 1];
    const [r, c] = cell;
    if (r === last[0] && c === last[1]) return;
    if (Math.abs(r - last[0]) + Math.abs(c - last[1]) !== 1) return;
    if (NumberlinkEngine.isComplete(puzzle, paths, drag)) return;

    const prev = path[path.length - 2];
    if (prev && prev[0] === r && prev[1] === c) {
        path.pop(); // retracing a step removes it
        render();
        return;
    }
    const owner = NumberlinkEngine.owner(paths, r, c);
    if (owner?.sym === drag) return;
    const endpoint = NumberlinkEngine.endpointSymbol(puzzle, r, c);
    if (endpoint && endpoint !== drag) return;
    if (owner) paths.set(owner.sym, paths.get(owner.sym).slice(0, owner.index)); // another path is cut here
    path.push([r, c]);
    render();
});

const endDrag = () => {
    if (!drag) return;
    drag = null;
    checkSolved();
};
board.addEventListener('pointerup', endDrag);
board.addEventListener('pointercancel', endDrag);

function checkSolved() {
    if (isSolved || !NumberlinkEngine.isSolved(puzzle, paths)) return;
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
