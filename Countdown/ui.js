let currentLevelIdx = 0;
let level = null;
let tiles = [];        // [{ value, used }]
let steps = [];        // [{ text, tiles }]: step text and the tiles before it, for undo
let first = null;      // index of the first selected tile
let op = null;         // chosen operator
let isSolved = false;
let statusKey = 'status_play';

const tilesEl = document.getElementById('tiles');
const targetEl = document.getElementById('target');
const stepsEl = document.getElementById('steps');
const statusEl = document.getElementById('status');
const levelInfoEl = document.getElementById('level-info');
const countersEl = document.getElementById('counters');
const undoBtn = document.getElementById('undoBtn');
const opButtons = [...document.querySelectorAll('.ops button')];

function loadLevel(idx) {
    level = LevelRegistry[idx];
    if (!level) return;

    currentLevelIdx = idx;
    Progress.setCurrent(idx);
    tiles = level.numbers.map(value => ({ value, used: false }));
    steps = [];
    first = null;
    op = null;
    isSolved = false;
    setStatus('status_play');
    updateLevelInfo();
    render();
}

function render() {
    targetEl.innerText = level.target;
    tilesEl.innerHTML = tiles.map((tile, i) => {
        const classes = ['tile', tile.used ? 'used' : '', i === first ? 'selected' : '',
            i >= level.numbers.length ? 'result' : '', isSolved && tile.value === level.target ? 'hit' : ''].join(' ');
        return `<button class="${classes}" onclick="pickTile(${i})" ${tile.used ? 'disabled' : ''}>${tile.value}</button>`;
    }).join('');

    opButtons.forEach(btn => btn.classList.toggle('primary', btn.dataset.op === op));
    stepsEl.innerHTML = steps.map(step => `<div class="step">${step.text}</div>`).join('');

    const available = tiles.filter(t => !t.used).map(t => t.value);
    const away = CountdownEngine.closest(available, level.target);
    countersEl.innerText = `${i18n.t('steps')}: ${steps.length} · ${i18n.t('closest')}: ${away === 0 ? i18n.t('exact') : away}`;
    undoBtn.disabled = steps.length === 0 || isSolved;
}

window.pickTile = (i) => {
    if (isSolved || tiles[i].used) return;
    if (first === null) {
        first = i;
    } else if (first === i) {
        first = null;
        op = null;
    } else if (op === null) {
        first = i;
    } else {
        combine(first, op, i);
        return;
    }
    if (statusKey === 'status_invalid') setStatus('status_play');
    render();
};

window.pickOp = (symbol) => {
    if (isSolved || first === null) return;
    op = op === symbol ? null : symbol;
    render();
};

function combine(i, symbol, j) {
    const a = tiles[i].value;
    const b = tiles[j].value;
    const result = CountdownEngine.apply(a, symbol, b);
    if (result === null) {
        setStatus('status_invalid');
        return;
    }

    steps.push({ text: `${a} ${symbol} ${b} = ${result}`, tiles: tiles.map(t => ({ ...t })) });
    tiles[i].used = true;
    tiles[j].used = true;
    tiles.push({ value: result, used: false });
    first = null;
    op = null;
    setStatus('status_play');
    render();

    if (result === level.target) {
        isSolved = true;
        setStatus('status_solved', { n: steps.length });
        Progress.markSolved(currentLevelIdx);
        render();
        const solvedLevelIdx = currentLevelIdx;
        setTimeout(() => {
            if (solvedLevelIdx === currentLevelIdx) nextLevel();
        }, 2200);
    }
}

window.undo = () => {
    if (!steps.length || isSolved) return;
    tiles = steps.pop().tiles;
    first = null;
    op = null;
    setStatus('status_play');
    render();
};

function nextLevel() {
    if (currentLevelIdx + 1 < LevelRegistry.length) {
        loadLevel(currentLevelIdx + 1);
    } else {
        setStatus('all_levels_cleared');
    }
}

function setStatus(key, params = {}) {
    statusKey = key;
    statusEl.innerText = i18n.t(key, { target: level.target, ...params });
}

function updateLevelInfo() {
    levelInfoEl.innerText = `${i18n.t('level')} ${currentLevelIdx + 1}/${LevelRegistry.length}: ${level.name}`;
}

document.addEventListener('keydown', (event) => {
    const inFormControl = event.target instanceof Element && event.target.closest('select, input');
    if (inFormControl || document.querySelector('.modal.active')) return;
    const keyOps = { '+': '+', '-': '-', '*': '×', 'x': '×', '/': '÷', ':': '÷' };
    if (keyOps[event.key]) {
        pickOp(keyOps[event.key]);
    } else if (event.key === 'Backspace' || event.key.toLowerCase() === 'z') {
        undo();
    } else if (event.key === 'Escape') {
        first = null; op = null; render();
    } else {
        return;
    }
    event.preventDefault();
});

document.getElementById('restartBtn').onclick = () => loadLevel(currentLevelIdx);

window.addEventListener('langChanged', () => {
    setStatus(statusKey, { n: steps.length });
    updateLevelInfo();
    render();
});

// Initial Load
if (LevelRegistry.length > 0) loadLevel(Progress.startLevel());
