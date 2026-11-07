const LONG_PRESS_MS = 350;

let currentLevelIdx = 0;
let state = null;
let flagMode = false;
let isOver = false;      // solved or exploded
let statusKey = 'status_play';
let press = null;        // { r, c, timer, flagged } during a pointer press

const board = document.getElementById('game-board');
const statusEl = document.getElementById('status');
const levelInfoEl = document.getElementById('level-info');
const countersEl = document.getElementById('counters');
const flagBtn = document.getElementById('flagBtn');

function loadLevel(idx) {
    const level = LevelRegistry[idx];
    if (!level) return;

    currentLevelIdx = idx;
    Progress.setCurrent(idx);
    state = MinesweeperEngine.parse(level);
    isOver = false;
    press = null;
    setStatus('status_play');
    updateLevelInfo();
    render();
}

function render() {
    board.style.gridTemplateColumns = `repeat(${state.width}, 1fr)`;
    board.style.maxWidth = `${state.width * 44}px`;
    const cells = [];
    for (let r = 0; r < state.height; r++) {
        for (let c = 0; c < state.width; c++) {
            const s = state.cells[r][c];
            const mine = state.mines[r][c];
            let content = '';
            const classes = ['cell', s];
            if (s === 'revealed') {
                if (mine) { classes.push('mine', state.exploded && state.exploded[0] === r && state.exploded[1] === c ? 'exploded' : ''); content = '💣'; }
                else if (state.numbers[r][c]) { classes.push(`n${state.numbers[r][c]}`); content = state.numbers[r][c]; }
            } else if (s === 'flag') {
                content = '🚩';
                if (isOver && !mine && state.exploded) classes.push('wrong');
            } else if (isOver && mine) {
                classes.push('shown'); content = '💣';
            }
            cells.push(`<div class="${classes.join(' ')}" data-r="${r}" data-c="${c}">${content}</div>`);
        }
    }
    board.innerHTML = cells.join('');
    countersEl.innerText = `${i18n.t('mines')}: ${state.total - MinesweeperEngine.flagsPlaced(state)}`;
    flagBtn.classList.toggle('primary', flagMode);
}

function cellOf(event) {
    const el = event.target.closest('.cell');
    return el ? [Number(el.dataset.r), Number(el.dataset.c)] : null;
}

// A tap reveals (or chords on a number); a long press or right-click flags; flag mode swaps the two
board.addEventListener('pointerdown', (event) => {
    if (isOver) return;
    const at = cellOf(event);
    if (!at) return;
    event.preventDefault();
    const [r, c] = at;
    if (event.button === 2) { flagAt(r, c); return; }
    press = { r, c, flagged: false, timer: setTimeout(() => { if (press) { press.flagged = true; flagAt(r, c); } }, LONG_PRESS_MS) };
});

board.addEventListener('pointerup', (event) => {
    if (!press) return;
    clearTimeout(press.timer);
    const { r, c, flagged } = press;
    press = null;
    if (flagged || isOver) return;
    const at = cellOf(event);
    if (!at || at[0] !== r || at[1] !== c) return;
    if (flagMode) { flagAt(r, c); return; }
    act(r, c);
});

const cancelPress = () => { if (press) { clearTimeout(press.timer); press = null; } };
board.addEventListener('pointercancel', cancelPress);
board.addEventListener('pointerleave', cancelPress);
board.addEventListener('contextmenu', (event) => event.preventDefault());

function flagAt(r, c) {
    if (isOver) return;
    MinesweeperEngine.toggleFlag(state, r, c);
    render();
}

function act(r, c) {
    const s = state.cells[r][c];
    if (s === 'flag') return;
    const safe = s === 'revealed' ? MinesweeperEngine.chord(state, r, c) : MinesweeperEngine.reveal(state, r, c);
    if (!safe) {
        isOver = true;
        setStatus('status_boom');
        render();
        return;
    }
    render();
    checkSolved();
}

window.toggleFlagMode = () => {
    flagMode = !flagMode;
    render();
};

function checkSolved() {
    if (!MinesweeperEngine.isSolved(state)) return;
    isOver = true;
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
    levelInfoEl.innerText = `${i18n.t('level')} ${currentLevelIdx + 1}/${LevelRegistry.length}: ${level.name} (${state.width}×${state.height}, ${state.total} 💣)`;
}

document.addEventListener('keydown', (event) => {
    const inFormControl = event.target instanceof Element && event.target.closest('select, input');
    if (inFormControl || document.querySelector('.modal.active')) return;
    if (event.key.toLowerCase() === 'r') { loadLevel(currentLevelIdx); event.preventDefault(); }
    else if (event.key.toLowerCase() === 'f') { toggleFlagMode(); event.preventDefault(); }
});

document.getElementById('restartBtn').onclick = () => loadLevel(currentLevelIdx);

window.addEventListener('langChanged', () => {
    setStatus(statusKey);
    updateLevelInfo();
    render();
});

// Initial Load
if (LevelRegistry.length > 0) loadLevel(Progress.startLevel());
