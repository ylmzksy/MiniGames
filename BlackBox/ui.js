let currentLevelIdx = 0;
let level = null;
let atomSet = null;
let results = {};     // port key -> { type, label }
let exitCount = 0;    // numbers the entry/exit pairs
let rays = 0;
let guesses = new Set(); // "r,c" keys of guessed atoms
let revealed = false;
let statusKey = 'status_play';
let statusParams = {};

const board = document.getElementById('game-board');
const statusEl = document.getElementById('status');
const levelInfoEl = document.getElementById('level-info');
const countersEl = document.getElementById('counters');
const checkBtn = document.getElementById('checkBtn');

function loadLevel(idx) {
    level = LevelRegistry[idx];
    if (!level) return;

    currentLevelIdx = idx;
    Progress.setCurrent(idx);
    atomSet = BlackBoxEngine.atomSet(level.atoms);
    results = {};
    exitCount = 0;
    rays = 0;
    guesses = new Set();
    revealed = false;
    setStatus('status_play');
    updateLevelInfo();
    render();
}

function render() {
    const n = level.size;
    board.style.gridTemplateColumns = `repeat(${n + 2}, 1fr)`;
    board.style.maxWidth = `${(n + 2) * 52}px`;

    const cells = [];
    for (let r = -1; r <= n; r++) {
        for (let c = -1; c <= n; c++) {
            const port = BlackBoxEngine.portAt(n, [r, c]);
            const isCorner = (r === -1 || r === n) && (c === -1 || c === n);
            if (isCorner) {
                cells.push('<div class="cell corner"></div>');
            } else if (port) {
                cells.push(renderPort(port));
            } else {
                cells.push(renderInner(r, c));
            }
        }
    }
    board.innerHTML = cells.join('');

    countersEl.innerText = `${i18n.t('rays')}: ${rays} · ${i18n.t('guesses')}: ${guesses.size}/${level.atoms.length}`;
    checkBtn.disabled = revealed || guesses.size !== level.atoms.length;
}

function renderPort(port) {
    const result = results[BlackBoxEngine.portKey(port)];
    const classes = ['cell', 'port', result ? `fired ${result.type}` : ''].join(' ');
    return `<button class="${classes}" onclick="fireRay('${port.side}', ${port.index})" ${result || revealed ? 'disabled' : ''}>
        ${result ? result.label : ''}
    </button>`;
}

function renderInner(r, c) {
    const key = `${r},${c}`;
    const guessed = guesses.has(key);
    const isAtom = atomSet.has(key);
    const classes = ['cell', 'inner', guessed ? 'guess' : ''];
    if (revealed) {
        if (isAtom) classes.push(guessed ? 'atom correct' : 'atom missed');
        else if (guessed) classes.push('wrong');
    }
    return `<div class="${classes.join(' ')}" onclick="toggleGuess(${r}, ${c})"></div>`;
}

window.fireRay = (side, index) => {
    const port = { side, index };
    const key = BlackBoxEngine.portKey(port);
    if (revealed || results[key]) return;

    const result = BlackBoxEngine.traceRay(level.size, atomSet, port);
    rays++;
    if (result.type === 'exit') {
        exitCount++;
        const label = String(exitCount);
        results[key] = { type: 'exit', label };
        results[BlackBoxEngine.portKey(result.port)] = { type: 'exit', label };
    } else {
        results[key] = { type: result.type, label: result.type === 'hit' ? 'H' : 'R' };
    }
    render();
};

window.toggleGuess = (r, c) => {
    if (revealed) return;
    const key = `${r},${c}`;
    if (guesses.has(key)) {
        guesses.delete(key);
    } else if (guesses.size < level.atoms.length) {
        guesses.add(key);
    }
    render();
};

window.checkGuesses = () => {
    if (revealed || guesses.size !== level.atoms.length) return;
    const correct = BlackBoxEngine.correctGuesses(atomSet, guesses);
    if (correct < level.atoms.length) {
        setStatus('status_wrong', { n: correct, total: level.atoms.length });
        return;
    }

    revealed = true;
    setStatus('status_solved', { rays });
    Progress.markSolved(currentLevelIdx);
    render();
    const solvedLevelIdx = currentLevelIdx;
    setTimeout(() => {
        if (solvedLevelIdx === currentLevelIdx) nextLevel();
    }, 2200);
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
    statusParams = params;
    statusEl.innerText = i18n.t(key, params);
}

function updateLevelInfo() {
    levelInfoEl.innerText = `${i18n.t('level')} ${currentLevelIdx + 1}/${LevelRegistry.length}: ${level.name}`;
}

document.getElementById('restartBtn').onclick = () => loadLevel(currentLevelIdx);

window.addEventListener('langChanged', () => {
    setStatus(statusKey, statusParams);
    updateLevelInfo();
    render();
});

// Initial Load
if (LevelRegistry.length > 0) loadLevel(Progress.startLevel());
