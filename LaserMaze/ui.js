let currentLevelIdx = 0;
let puzzle = null;
let beam = null;
let taps = 0;
let isSolved = false;
let isOver = false;
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
    puzzle = LaserEngine.parse(level);
    taps = 0;
    isSolved = false;
    isOver = false;
    beam = LaserEngine.trace(puzzle);
    setStatus('status_play');
    updateLevelInfo();
    render();
}

function dirName([dr, dc]) {
    return dr < 0 ? 'up' : dr > 0 ? 'down' : dc < 0 ? 'left' : 'right';
}

function render() {
    const n = puzzle.size;
    board.style.gridTemplateColumns = `repeat(${n}, 1fr)`;
    board.style.maxWidth = `${n * 52}px`;

    // beam stubs per cell: the direction it came from and the direction it leaves
    const stubs = new Map();
    beam.path.forEach(({ r, c, in: din, out }) => {
        const list = stubs.get(`${r},${c}`) || stubs.set(`${r},${c}`, []).get(`${r},${c}`);
        if (din) list.push(dirName([-din[0], -din[1]]));
        if (out) list.push(dirName(out));
    });
    const lit = beam.result === 'target';
    const cells = [];
    for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
            const ch = puzzle.cells[r][c];
            const key = `${r},${c}`;
            const kind = ch === '#' ? 'wall' : ch === 'B' ? 'bomb' : ch === 'T' ? 'target' : ch === 'S' ? 'source' : ch === '/' ? 'mirror slash' : ch === '\\' ? 'mirror backslash' : 'empty';
            const classes = ['cell', kind, puzzle.fixed.has(key) ? 'fixed' : '', LaserEngine.canRotate(puzzle, r, c) && !isOver && !isSolved ? 'free' : '',
                lit && ch === 'T' ? 'lit' : '', beam.bomb && beam.bomb[0] === r && beam.bomb[1] === c ? 'exploded' : ''].join(' ');
            const beamHtml = (stubs.get(key) || []).map(d => `<i class="beam ${d}"></i>`).join('');
            cells.push(`<div class="${classes}" onclick="handleTap(${r}, ${c})">${beamHtml}<span class="icon"></span></div>`);
        }
    }
    board.innerHTML = cells.join('');
    countersEl.innerText = `${i18n.t('taps')}: ${taps} · ${i18n.t('beam_' + beam.result)}`;
}

window.handleTap = (r, c) => {
    if (isSolved || isOver) return;
    if (!LaserEngine.rotate(puzzle, r, c)) return;
    taps++;
    beam = LaserEngine.trace(puzzle);
    render();
    if (beam.result === 'target') {
        isSolved = true;
        setStatus('status_solved');
        Progress.markSolved(currentLevelIdx);
        render();
        const solvedLevelIdx = currentLevelIdx;
        setTimeout(() => {
            if (solvedLevelIdx === currentLevelIdx) nextLevel();
        }, 1800);
    } else if (beam.result === 'bomb') {
        isOver = true;
        setStatus('status_bomb');
        render();
    }
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
    const level = LevelRegistry[currentLevelIdx];
    levelInfoEl.innerText = `${i18n.t('level')} ${currentLevelIdx + 1}/${LevelRegistry.length}: ${level.name} (${puzzle.size}×${puzzle.size})`;
}

document.addEventListener('keydown', (event) => {
    if (event.key.toLowerCase() === 'r' && !document.querySelector('.modal.active')) loadLevel(currentLevelIdx);
});

document.getElementById('restartBtn').onclick = () => loadLevel(currentLevelIdx);

window.addEventListener('langChanged', () => {
    setStatus(statusKey);
    updateLevelInfo();
    render();
});

// Initial Load
if (LevelRegistry.length > 0) loadLevel(Progress.startLevel());
