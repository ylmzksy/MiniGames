const SWIPE_MIN = 24; // px a finger must travel on the board to count as a swipe

let currentLevelIdx = 0;
let puzzle = null;
let state = null;      // { player: [r, c], boxes: [[r, c], ...] }
let history = [];      // previous states, for undo
let moves = 0;
let pushes = 0;
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
    puzzle = SokobanEngine.parse(level);
    state = puzzle.state;
    history = [];
    moves = 0;
    pushes = 0;
    isSolved = false;
    setStatus('status_play');
    updateLevelInfo();
    render();
}

function render() {
    board.style.gridTemplateColumns = `repeat(${puzzle.width}, 1fr)`;
    board.style.maxWidth = `${puzzle.width * 64}px`;

    const cells = [];
    for (let r = 0; r < puzzle.height; r++) {
        for (let c = 0; c < puzzle.width; c++) {
            cells.push(`<div class="${cellClasses(r, c)}"></div>`);
        }
    }
    board.innerHTML = cells.join('');

    countersEl.innerText = `${i18n.t('moves')}: ${moves} · ${i18n.t('pushes')}: ${pushes}`;
    undoBtn.disabled = history.length === 0 || isSolved;
}

function cellClasses(r, c) {
    if (puzzle.walls[r][c]) return 'cell wall';
    if (!puzzle.floor[r][c]) return 'cell void';
    const classes = ['cell', 'floor'];
    if (puzzle.goals[r][c]) classes.push('goal');
    if (SokobanEngine.boxAt(state, r, c) >= 0) classes.push('box');
    if (state.player[0] === r && state.player[1] === c) classes.push('player');
    if (isSolved) classes.push('solved');
    return classes.join(' ');
}

window.movePlayer = (dir) => {
    if (isSolved) return;
    const result = SokobanEngine.move(puzzle, state, dir);
    if (!result) return;

    history.push(state);
    state = result.state;
    moves++;
    if (result.pushed) pushes++;
    render();
    checkSolved();
};

window.undo = () => {
    if (!history.length || isSolved) return;
    const previous = history.pop();
    if (SokobanEngine.boxAt(previous, ...state.player) >= 0) pushes--;
    state = previous;
    moves--;
    render();
};

function checkSolved() {
    if (!SokobanEngine.isSolved(puzzle, state)) return;
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
    statusEl.innerText = i18n.t(key, { moves, pushes });
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

// Swiping on the board moves the player one step in the swipe direction
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
