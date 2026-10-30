let currentLevelIdx = 0;
let puzzle = null;
let bridges = new Map(); // pair key -> 1 or 2
let selected = null;     // island index
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
    puzzle = HashiEngine.parse(level);
    bridges = new Map();
    selected = null;
    isSolved = false;
    setStatus('status_play');
    updateLevelInfo();
    render();
}

// Island centers as percentages of the board
function pos(island) {
    return [((island.c + 0.5) / puzzle.width) * 100, ((island.r + 0.5) / puzzle.height) * 100];
}

function render() {
    const { width, height } = puzzle;
    board.style.aspectRatio = `${width} / ${height}`;
    board.style.maxWidth = `${width * 52}px`;
    board.style.setProperty('--cell', `${100 / width}%`);

    const targets = new Set(selected === null ? [] : puzzle.pairs
        .filter(p => (p.a === selected || p.b === selected) && !HashiEngine.blocked(puzzle, bridges, p))
        .map(p => p.a === selected ? p.b : p.a));

    const bridgeHtml = puzzle.pairs.filter(p => bridges.get(p.key)).map(p => {
        const [a, b] = [puzzle.islands[p.a], puzzle.islands[p.b]];
        const horizontal = a.r === b.r;
        const [x1, y1] = pos(a);
        const [x2, y2] = pos(b);
        const style = horizontal
            ? `left:${Math.min(x1, x2)}%;width:${Math.abs(x2 - x1)}%;top:${y1}%`
            : `top:${Math.min(y1, y2)}%;height:${Math.abs(y2 - y1)}%;left:${x1}%`;
        return `<div class="bridge ${horizontal ? 'h' : 'v'} n${bridges.get(p.key)}" style="${style}" onclick="cycleBridge('${p.key}')"><i></i><i></i></div>`;
    }).join('');

    const islandHtml = puzzle.islands.map((island, i) => {
        const [x, y] = pos(island);
        const classes = ['island', HashiEngine.islandState(puzzle, bridges, i), i === selected ? 'selected' : '',
            targets.has(i) ? 'target' : '', isSolved ? 'solved' : ''].join(' ');
        return `<div class="${classes}" style="left:${x}%;top:${y}%" onclick="pickIsland(${i})">${island.n}</div>`;
    }).join('');

    board.innerHTML = bridgeHtml + islandHtml;

    const total = [...bridges.values()].reduce((s, v) => s + v, 0);
    const connected = HashiEngine.isConnected(puzzle, bridges);
    countersEl.innerText = `${i18n.t('bridges')}: ${total}` + (connected ? '' : ` · ${i18n.t('not_connected')}`);
}

window.pickIsland = (i) => {
    if (isSolved) return;
    if (selected === null || selected === i) {
        selected = selected === i ? null : i;
        if (statusKey !== 'status_play') setStatus('status_play');
        render();
        return;
    }
    const pair = HashiEngine.pairOf(puzzle, selected, i);
    if (!pair) {
        selected = i; // not in line of sight: start over from this island
        render();
        return;
    }
    if (!bridges.get(pair.key) && HashiEngine.blocked(puzzle, bridges, pair)) {
        setStatus('status_crossing');
        selected = null;
        render();
        return;
    }
    selected = null;
    cycleBridge(pair.key);
};

// A bridge cycles single → double → none
window.cycleBridge = (key) => {
    if (isSolved) return;
    const n = bridges.get(key) || 0;
    if (n === 2) bridges.delete(key); else bridges.set(key, n + 1);
    if (statusKey === 'status_crossing') setStatus('status_play');
    render();
    checkSolved();
};

function checkSolved() {
    if (!HashiEngine.isSolved(puzzle, bridges)) return;
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
