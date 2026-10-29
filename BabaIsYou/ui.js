const SWIPE_MIN = 24; // px a finger must travel on the board to count as a swipe
const ICONS = { baba: '🐇', wall: '', rock: '🪨', flag: '🚩', water: '', skull: '💀', key: '🔑', door: '🚪', keke: '🐈' };

let currentLevelIdx = 0;
let puzzle = null;
let state = null;      // { objects: [{ name | text, r, c }] }
let history = [];      // previous states, for undo
let moves = 0;
let isSolved = false;
let statusKey = 'status_play';

const board = document.getElementById('game-board');
const statusEl = document.getElementById('status');
const levelInfoEl = document.getElementById('level-info');
const rulesEl = document.getElementById('rules');
const countersEl = document.getElementById('counters');
const undoBtn = document.getElementById('undoBtn');

function loadLevel(idx) {
    const level = LevelRegistry[idx];
    if (!level) return;

    currentLevelIdx = idx;
    Progress.setCurrent(idx);
    puzzle = BabaEngine.parse(level);
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
    board.style.maxWidth = `${puzzle.width * 50}px`;

    const sentences = BabaEngine.rules(state);
    const props = BabaEngine.propertyMap(sentences);
    const cells = [];
    for (let r = 0; r < puzzle.height; r++) {
        for (let c = 0; c < puzzle.width; c++) {
            const here = BabaEngine.at(state, r, c).map(o => renderObject(o, props)).join('');
            cells.push(`<div class="cell">${here}</div>`);
        }
    }
    board.innerHTML = cells.join('');

    rulesEl.innerHTML = sentences.length
        ? sentences.map(s => `<span class="rule">${s.join(' ')}</span>`).join('')
        : `<span class="rule none">${i18n.t('no_rules')}</span>`;
    countersEl.innerText = `${i18n.t('moves')}: ${moves}`;
    undoBtn.disabled = history.length === 0 || isSolved;
}

function renderObject(obj, props) {
    if (obj.text) {
        const kind = BabaEngine.isNounText(obj.text) ? 'noun' : obj.text === 'IS' ? 'verb' : 'prop';
        return `<div class="obj text ${kind} w-${obj.text}">${obj.text}</div>`;
    }
    const classes = ['obj', 'thing', obj.name, BabaEngine.has(obj, 'YOU', props) ? 'you' : '', isSolved ? 'solved' : ''].join(' ');
    return `<div class="${classes}">${ICONS[obj.name] ?? ''}</div>`;
}

window.movePlayer = (dir) => {
    if (isSolved) return;
    const result = BabaEngine.move(puzzle, state, dir);
    if (!result) return;

    history.push(state);
    state = result.state;
    moves++;
    if (result.won) {
        isSolved = true;
        setStatus('status_won');
        Progress.markSolved(currentLevelIdx);
        render();
        const solvedLevelIdx = currentLevelIdx;
        setTimeout(() => {
            if (solvedLevelIdx === currentLevelIdx) nextLevel();
        }, 2000);
        return;
    }
    setStatus(BabaEngine.hasYou(state) ? 'status_play' : 'status_no_you');
    render();
};

window.undo = () => {
    if (!history.length || isSolved) return;
    state = history.pop();
    moves--;
    setStatus(BabaEngine.hasYou(state) ? 'status_play' : 'status_no_you');
    render();
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
