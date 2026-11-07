const SWIPE_MIN = 24;

let currentLevelIdx = 0;
let state = null;
let isSolved = false;
let isOver = false;
let statusKey = 'status_play';

const board = document.getElementById('game-board');
const nextEl = document.getElementById('next-tile');
const statusEl = document.getElementById('status');
const levelInfoEl = document.getElementById('level-info');
const countersEl = document.getElementById('counters');
const nextBtn = document.getElementById('nextBtn');

function loadLevel(idx) {
    const level = LevelRegistry[idx];
    if (!level) return;

    currentLevelIdx = idx;
    Progress.setCurrent(idx);
    state = ThreesEngine.create(level);
    isSolved = false;
    isOver = false;
    setStatus('status_play');
    updateLevelInfo();
    render();
}

function tileClass(v) {
    return v === 1 ? 'one' : v === 2 ? 'two' : v ? 'three' : 'empty';
}

function render() {
    board.innerHTML = state.board.flat().map(v => `<div class="tile ${tileClass(v)}">${v || ''}</div>`).join('');
    nextEl.innerHTML = `<div class="tile small ${tileClass(state.next)}">${state.next}</div>`;
    countersEl.innerText = `${i18n.t('score')}: ${ThreesEngine.score(state.board)} · ${i18n.t('best_tile')}: ${ThreesEngine.maxTile(state.board)} / ${state.target}`;
    nextBtn.hidden = !(isSolved && currentLevelIdx + 1 < LevelRegistry.length);
}

window.slide = (dir) => {
    if (isOver) return;
    if (!ThreesEngine.move(state, dir)) return;
    render();
    if (!isSolved && ThreesEngine.maxTile(state.board) >= state.target) {
        isSolved = true;
        setStatus('status_solved');
        Progress.markSolved(currentLevelIdx);
        render();
    }
    if (!ThreesEngine.canMove(state)) {
        isOver = true;
        setStatus(isSolved ? 'status_over_won' : 'status_over');
    }
};

function nextLevel() {
    if (currentLevelIdx + 1 < LevelRegistry.length) loadLevel(currentLevelIdx + 1);
}

function setStatus(key) {
    statusKey = key;
    statusEl.innerText = i18n.t(key, { target: state.target });
}

function updateLevelInfo() {
    const level = LevelRegistry[currentLevelIdx];
    levelInfoEl.innerText = `${i18n.t('level')} ${currentLevelIdx + 1}/${LevelRegistry.length}: ${level.name}`;
}

const KEYS = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right' };
document.addEventListener('keydown', (event) => {
    if (document.querySelector('.modal.active')) return;
    const dir = KEYS[event.key] ?? KEYS[event.key.toLowerCase()];
    if (dir) { slide(dir); event.preventDefault(); }
    else if (event.key.toLowerCase() === 'r') { loadLevel(currentLevelIdx); event.preventDefault(); }
});

let touchStart = null;
board.addEventListener('touchstart', (event) => { const t = event.changedTouches[0]; touchStart = [t.clientX, t.clientY]; }, { passive: true });
board.addEventListener('touchend', (event) => {
    if (!touchStart) return;
    const t = event.changedTouches[0];
    const dx = t.clientX - touchStart[0];
    const dy = t.clientY - touchStart[1];
    touchStart = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_MIN) return;
    slide(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
});

nextBtn.onclick = nextLevel;
document.getElementById('restartBtn').onclick = () => loadLevel(currentLevelIdx);

window.addEventListener('langChanged', () => {
    setStatus(statusKey);
    updateLevelInfo();
    render();
});

// Initial Load
if (LevelRegistry.length > 0) loadLevel(Progress.startLevel());
