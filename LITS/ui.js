const CYCLE = [null, 'shaded', 'dot'];
const TINTS = ['#fde2e2', '#e2ecfd', '#e2fde8', '#fdf6d9', '#f0e2fd', '#e2f9fd', '#fde9d9', '#e9e9e9', '#f9e2f3', '#e6f3d6', '#ffe8cc', '#d9f0ff'];

let currentLevelIdx = 0;
let puzzle = null;
let marks = [];
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
    puzzle = LitsEngine.parse(level);
    marks = puzzle.regions.map(row => row.map(() => null));
    isSolved = false;
    setStatus('status_play');
    updateLevelInfo();
    render();
}

function render() {
    const { width, height } = puzzle;
    board.style.gridTemplateColumns = `repeat(${width}, 1fr)`;
    board.style.maxWidth = `${width * 56}px`;

    const blocks = LitsEngine.blocks(puzzle, marks);
    const pieces = LitsEngine.pieces(puzzle, marks);
    const clashes = LitsEngine.clashes(puzzle, marks, pieces);
    const counts = Object.fromEntries(puzzle.ids.map(id => [id, LitsEngine.shadedCount(puzzle, marks, id)]));
    const cells = [];
    for (let r = 0; r < height; r++) {
        for (let c = 0; c < width; c++) {
            const id = puzzle.regions[r][c];
            const borders = [
                r === 0 || puzzle.regions[r - 1][c] !== id ? 'bt' : '',
                c === width - 1 || puzzle.regions[r][c + 1] !== id ? 'br' : '',
                r === height - 1 || puzzle.regions[r + 1][c] !== id ? 'bb' : '',
                c === 0 || puzzle.regions[r][c - 1] !== id ? 'bl' : ''
            ];
            const key = `${r},${c}`;
            const classes = ['cell', marks[r][c] ?? 'open', counts[id] > 4 ? 'over' : '',
                blocks.has(key) || clashes.has(key) ? 'bad' : '',
                pieces[id] && counts[id] === 4 ? 'done' : '', isSolved ? 'solved' : '', ...borders].join(' ');
            const tint = TINTS[puzzle.ids.indexOf(id) % TINTS.length];
            const label = marks[r][c] === 'dot' ? '•' : (marks[r][c] === 'shaded' && pieces[id] && counts[id] === 4 ? pieces[id].shape : '');
            cells.push(`<div class="${classes}" data-r="${r}" data-c="${c}" style="--tint:${tint}">${label}</div>`);
        }
    }
    board.innerHTML = cells.join('');

    const done = puzzle.ids.filter(id => pieces[id] && counts[id] === 4).length;
    const connected = LitsEngine.isConnected(puzzle, marks);
    countersEl.innerText = `${i18n.t('regions_done')}: ${done}/${puzzle.ids.length}` + (connected || !marks.flat().includes('shaded') ? '' : ` · ${i18n.t('split')}`);
}

function setCell(r, c, value) {
    if (isSolved || marks[r][c] === value) return;
    marks[r][c] = value;
    render();
    checkSolved();
}

// Tap cycles empty → shaded → dot; right-click cycles backwards
board.addEventListener('pointerdown', (event) => {
    const el = event.target.closest('.cell');
    if (!el || isSolved) return;
    event.preventDefault();
    const r = Number(el.dataset.r);
    const c = Number(el.dataset.c);
    const step = event.button === 2 ? -1 : 1;
    setCell(r, c, CYCLE[(CYCLE.indexOf(marks[r][c]) + step + CYCLE.length) % CYCLE.length]);
});
board.addEventListener('contextmenu', (event) => event.preventDefault());

function checkSolved() {
    if (!LitsEngine.isSolved(puzzle, marks)) return;
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
