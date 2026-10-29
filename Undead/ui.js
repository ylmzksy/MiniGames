const MONSTER_ICONS = { G: '👻', V: '🧛', Z: '🧟' };

let currentLevelIdx = 0;
let puzzle = null;
let grid = [];          // grid[r][c]: placed monster letter or null
let tool = 'G';         // monster placed on click, or 'erase'
let litClue = null;     // index of the clue whose sight line is highlighted
let isSolved = false;
let statusKey = 'status_play';

const board = document.getElementById('game-board');
const statusEl = document.getElementById('status');
const levelInfoEl = document.getElementById('level-info');
const paletteEl = document.getElementById('palette');

function loadLevel(idx) {
    const level = LevelRegistry[idx];
    if (!level) return;

    currentLevelIdx = idx;
    Progress.setCurrent(idx);
    puzzle = UndeadEngine.parse(level);
    grid = puzzle.mirrors.map(row => row.map(() => null));
    tool = 'G';
    litClue = null;
    isSolved = false;
    setStatus('status_play');
    updateLevelInfo();
    render();
}

function render() {
    const { width, height } = puzzle;
    board.style.gridTemplateColumns = `repeat(${width + 2}, 1fr)`;
    board.style.maxWidth = `${(width + 2) * 56}px`;

    const lit = new Set(litClue === null ? [] : puzzle.clues[litClue].path.map(({ r, c }) => `${r},${c}`));
    const cells = [];
    for (let r = -1; r <= height; r++) {
        for (let c = -1; c <= width; c++) {
            const clueIdx = clueIndexAt(r, c);
            if (clueIdx >= 0) {
                cells.push(renderClue(clueIdx));
            } else if (r < 0 || c < 0 || r >= height || c >= width) {
                cells.push('<div class="cell corner"></div>');
            } else {
                cells.push(renderInner(r, c, lit.has(`${r},${c}`)));
            }
        }
    }
    board.innerHTML = cells.join('');
    renderPalette();
}

// Index into puzzle.clues of the edge cell at (r, c), or -1
function clueIndexAt(r, c) {
    const { width, height } = puzzle;
    let port = null;
    if (r === -1 && c >= 0 && c < width) port = { side: 'top', index: c };
    else if (r === height && c >= 0 && c < width) port = { side: 'bottom', index: c };
    else if (c === -1 && r >= 0 && r < height) port = { side: 'left', index: r };
    else if (c === width && r >= 0 && r < height) port = { side: 'right', index: r };
    if (!port) return -1;
    return puzzle.clues.findIndex(clue => clue.side === port.side && clue.index === port.index);
}

function renderClue(idx) {
    const clue = puzzle.clues[idx];
    const state = UndeadEngine.clueState(clue, grid);
    const classes = ['cell', 'clue', state, idx === litClue ? 'lit' : ''].join(' ');
    return `<div class="${classes}" onclick="toggleClue(${idx})">${clue.count}</div>`;
}

function renderInner(r, c, lit) {
    const mirror = puzzle.mirrors[r][c];
    if (mirror) {
        return `<div class="cell mirror ${mirror === '/' ? 'slash' : 'backslash'} ${lit ? 'lit' : ''}"></div>`;
    }
    const monster = grid[r][c];
    const classes = ['cell', 'floor', lit ? 'lit' : '', isSolved ? 'solved' : ''].join(' ');
    return `<div class="${classes}" onclick="placeMonster(${r}, ${c})">${monster ? MONSTER_ICONS[monster] : ''}</div>`;
}

function renderPalette() {
    const placed = UndeadEngine.placed(grid);
    const buttons = UndeadEngine.monsters.map(m => {
        const over = placed[m] > puzzle.counts[m] ? 'over' : '';
        return `
            <button class="tool ${tool === m ? 'primary' : ''} ${over}" onclick="setTool('${m}')">
                <span class="icon">${MONSTER_ICONS[m]}</span>
                <span>${i18n.t('monster_' + m)}</span>
                <span class="count">${placed[m]}/${puzzle.counts[m]}</span>
            </button>
        `;
    });
    buttons.push(`
        <button class="tool ${tool === 'erase' ? 'primary' : ''}" onclick="setTool('erase')">
            <span class="icon">✕</span>
            <span>${i18n.t('erase')}</span>
            <span class="count"></span>
        </button>
    `);
    paletteEl.innerHTML = buttons.join('');
}

window.setTool = (t) => {
    tool = t;
    renderPalette();
};

window.toggleClue = (idx) => {
    litClue = litClue === idx ? null : idx;
    render();
};

window.placeMonster = (r, c) => {
    if (isSolved) return;
    // Placing the same monster again clears the cell
    grid[r][c] = (tool === 'erase' || grid[r][c] === tool) ? null : tool;
    render();
    checkSolved();
};

function checkSolved() {
    if (!UndeadEngine.isSolved(puzzle, grid)) return;
    isSolved = true;
    litClue = null;
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

document.addEventListener('keydown', (event) => {
    const inFormControl = event.target instanceof Element && event.target.closest('select, input');
    if (inFormControl || document.querySelector('.modal.active')) return;
    const tools = { g: 'G', v: 'V', z: 'Z', 1: 'G', 2: 'V', 3: 'Z', e: 'erase', 0: 'erase' };
    const t = tools[event.key.toLowerCase()];
    if (!t) return;
    setTool(t);
    event.preventDefault();
});

document.getElementById('restartBtn').onclick = () => loadLevel(currentLevelIdx);

window.addEventListener('langChanged', () => {
    setStatus(statusKey);
    updateLevelInfo();
    renderPalette();
});

// Initial Load
if (LevelRegistry.length > 0) loadLevel(Progress.startLevel());
