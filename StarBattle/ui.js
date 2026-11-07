const CYCLE = [null, 'star', 'dot'];
const TINTS = ['#fde2e2', '#e2ecfd', '#e2fde8', '#fdf6d9', '#f0e2fd', '#e2f9fd', '#fde9d9', '#e9e9e9', '#f9e2f3', '#e6f3d6'];

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
    puzzle = StarBattleEngine.parse(level);
    marks = puzzle.regions.map(row => row.map(() => null));
    isSolved = false;
    setStatus('status_play');
    updateLevelInfo();
    render();
}

function render() {
    const n = puzzle.size;
    board.style.gridTemplateColumns = `repeat(${n}, 1fr)`;
    board.style.maxWidth = `${n * 56}px`;

    const touching = StarBattleEngine.touching(puzzle, marks);
    const { rows, cols, regions } = StarBattleEngine.counts(puzzle, marks);
    const cells = [];
    for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
            const id = puzzle.regions[r][c];
            const over = rows[r] > puzzle.stars || cols[c] > puzzle.stars || regions[id] > puzzle.stars;
            const borders = [
                r === 0 || puzzle.regions[r - 1][c] !== id ? 'bt' : '',
                c === n - 1 || puzzle.regions[r][c + 1] !== id ? 'br' : '',
                r === n - 1 || puzzle.regions[r + 1][c] !== id ? 'bb' : '',
                c === 0 || puzzle.regions[r][c - 1] !== id ? 'bl' : ''
            ];
            const classes = ['cell', marks[r][c] ?? '', over ? 'over' : '', touching.has(`${r},${c}`) ? 'bad' : '', isSolved ? 'solved' : '', ...borders].join(' ');
            const tint = TINTS[puzzle.regionIds.indexOf(id) % TINTS.length];
            cells.push(`<div class="${classes}" data-r="${r}" data-c="${c}" style="--tint:${tint}">${marks[r][c] === 'star' ? '★' : marks[r][c] === 'dot' ? '•' : ''}</div>`);
        }
    }
    board.innerHTML = cells.join('');

    const placed = marks.flat().filter(m => m === 'star').length;
    countersEl.innerText = `${i18n.t('stars')}: ${placed}/${puzzle.stars * n}`;
}

function setCell(r, c, value) {
    if (isSolved || marks[r][c] === value) return;
    marks[r][c] = value;
    render();
    checkSolved();
}

// Tap cycles empty → star → dot; right-click cycles backwards
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
    if (!StarBattleEngine.isSolved(puzzle, marks)) return;
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
    statusEl.innerText = i18n.t(key, { n: puzzle.stars });
}

function updateLevelInfo() {
    const level = LevelRegistry[currentLevelIdx];
    levelInfoEl.innerText = `${i18n.t('level')} ${currentLevelIdx + 1}/${LevelRegistry.length}: ${level.name} (${puzzle.size}×${puzzle.size})`;
}

document.getElementById('restartBtn').onclick = () => loadLevel(currentLevelIdx);

window.addEventListener('langChanged', () => {
    setStatus(statusKey);
    updateLevelInfo();
    render();
});

// Initial Load
if (LevelRegistry.length > 0) loadLevel(Progress.startLevel());
