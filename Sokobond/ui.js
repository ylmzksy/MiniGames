const SWIPE_MIN = 24; // px a finger must travel on the board to count as a swipe

let currentLevelIdx = 0;
let puzzle = null;
let state = null;      // { atoms: [{ element, pos }], bonds: { "a-b": count } }
let history = [];      // previous states, for undo
let moves = 0;
let isSolved = false;
let statusKey = 'status_play';

const board = document.getElementById('game-board');
const statusEl = document.getElementById('status');
const levelInfoEl = document.getElementById('level-info');
const countersEl = document.getElementById('counters');
const undoBtn = document.getElementById('undoBtn');

function loadLevel(idx) {
    const level = LevelRegistry[idx];
    if (!level) return;

    currentLevelIdx = idx;
    Progress.setCurrent(idx);
    puzzle = SokobondEngine.parse(level);
    state = puzzle.state;
    history = [];
    moves = 0;
    isSolved = false;
    setStatus('status_play');
    updateLevelInfo();
    render();
}

function render() {
    board.style.gridTemplateColumns = `repeat(${puzzle.width}, 1fr)`;
    board.style.maxWidth = `${puzzle.width * 60}px`;

    const playerMolecule = SokobondEngine.molecule(state, puzzle.player);
    const cells = [];
    for (let r = 0; r < puzzle.height; r++) {
        for (let c = 0; c < puzzle.width; c++) {
            if (puzzle.walls[r][c]) {
                cells.push('<div class="cell wall"></div>');
                continue;
            }
            const i = SokobondEngine.atomAt(state, r, c);
            cells.push(`<div class="cell floor">${i >= 0 ? renderAtom(i, playerMolecule.has(i)) : ''}</div>`);
        }
    }
    board.innerHTML = cells.join('');

    countersEl.innerText = `${i18n.t('moves')}: ${moves}`;
    undoBtn.disabled = history.length === 0 || isSolved;
}

function renderAtom(i, inPlayerMolecule) {
    const atom = state.atoms[i];
    const [r, c] = atom.pos;
    const free = SokobondEngine.freeElectrons(state, i);

    // Half-bonds from this atom's center to the edge shared with each bonded neighbor
    const bonds = SokobondEngine.bondsOf(state, i).map(([j, n]) => {
        const [jr, jc] = state.atoms[j].pos;
        const side = jr < r ? 'up' : jr > r ? 'down' : jc < c ? 'left' : 'right';
        return Array.from({ length: n }, (_, k) =>
            `<span class="bond ${side} n${n} k${k}"></span>`).join('');
    }).join('');

    // Free electrons as dots around the atom, starting at the top and going clockwise
    const dots = Array.from({ length: free }, (_, k) =>
        `<span class="electron" style="transform: rotate(${k * (360 / free)}deg)"></span>`).join('');

    const classes = ['atom', `el-${atom.element}`, i === puzzle.player ? 'player' : '', inPlayerMolecule ? 'mine' : '', isSolved ? 'solved' : ''].join(' ');
    return `${bonds}<div class="${classes}">${atom.element}</div>${dots}`;
}

window.movePlayer = (dir) => {
    if (isSolved) return;
    const next = SokobondEngine.move(puzzle, state, dir);
    if (!next) return;

    history.push(state);
    state = next;
    moves++;
    render();
    checkSolved();
};

window.undo = () => {
    if (!history.length || isSolved) return;
    state = history.pop();
    moves--;
    render();
};

function checkSolved() {
    if (!SokobondEngine.isSolved(puzzle, state)) return;
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
    statusEl.innerText = i18n.t(key, { moves });
}

function updateLevelInfo() {
    const level = LevelRegistry[currentLevelIdx];
    levelInfoEl.innerText = `${i18n.t('level')} ${currentLevelIdx + 1}/${LevelRegistry.length}: ${level.name}`;
}

document.addEventListener('keydown', (event) => {
    const inFormControl = event.target instanceof Element && event.target.closest('select, input');
    if (inFormControl || document.querySelector('.modal.active')) return;
    const keys = {
        ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
        w: 'up', s: 'down', a: 'left', d: 'right'
    };
    const dir = keys[event.key] ?? keys[event.key.toLowerCase()];
    if (dir) {
        movePlayer(dir);
    } else if (event.key.toLowerCase() === 'z' || event.key === 'Backspace') {
        undo();
    } else if (event.key.toLowerCase() === 'r') {
        loadLevel(currentLevelIdx);
    } else {
        return;
    }
    event.preventDefault();
});

// Swiping on the board moves one step in the swipe direction
let touchStart = null;
board.addEventListener('touchstart', (event) => {
    const touch = event.changedTouches[0];
    touchStart = [touch.clientX, touch.clientY];
}, { passive: true });

board.addEventListener('touchend', (event) => {
    if (!touchStart) return;
    const touch = event.changedTouches[0];
    const dx = touch.clientX - touchStart[0];
    const dy = touch.clientY - touchStart[1];
    touchStart = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_MIN) return;
    if (Math.abs(dx) > Math.abs(dy)) {
        movePlayer(dx > 0 ? 'right' : 'left');
    } else {
        movePlayer(dy > 0 ? 'down' : 'up');
    }
});

document.getElementById('restartBtn').onclick = () => loadLevel(currentLevelIdx);

window.addEventListener('langChanged', () => {
    setStatus(statusKey);
    updateLevelInfo();
    render();
});

// Initial Load
if (LevelRegistry.length > 0) loadLevel(Progress.startLevel());
