/**
 * Fifteen page: tiles are created once per level and moved with CSS transforms
 * (translate by whole tile sizes), so each slide only touches the tiles that move.
 * Input: tap a tile in the gap's row or column to slide the whole run, arrow keys /
 * WASD or swipes move the neighbouring tile into the gap, Z undoes.
 */
const SWIPE_MIN = 24;
const SOLVED_DELAY = 2000;

let currentLevelIdx = 0;
let puzzle = null;
let cells = [];
let history = [];
let moves = 0;
let solved = false;
let statusKey = 'status_play';
let tileEls = {};

const board = document.getElementById('game-board');
const tray = document.getElementById('tray');
const preview = document.getElementById('goal-preview');
const statusEl = document.getElementById('status');
const levelInfoEl = document.getElementById('level-info');
const countersEl = document.getElementById('counters');
const undoBtn = document.getElementById('undoBtn');

function loadLevel(idx) {
    const level = LevelRegistry[idx];
    if (!level) return;
    currentLevelIdx = idx;
    Progress.setCurrent(idx);
    puzzle = FifteenEngine.parse(level);
    if (!FifteenEngine.isSolvable(puzzle.n, puzzle.start, puzzle.target)) console.warn(`Fifteen level ${idx + 1} cannot be solved`);
    cells = [...puzzle.start];
    history = [];
    moves = 0;
    solved = false;
    setStatus('status_play');
    updateLevelInfo();
    buildPreview();
    buildTiles();
    renderCounters();
}

/* ---------- Building ---------- */

// Where tile t belongs in the target, as [row, col]
function homeOf(tile) {
    const i = puzzle.target.indexOf(tile);
    return [Math.floor(i / puzzle.n), i % puzzle.n];
}

function pictureStyle(tile) {
    const n = puzzle.n;
    const [r, c] = homeOf(tile);
    return `background-image:url(${Pictures.url(puzzle.picture)});background-size:${n * 100}% ${n * 100}%;` +
        `background-position:${c / (n - 1) * 100}% ${r / (n - 1) * 100}%`;
}

function buildTiles() {
    const n = puzzle.n;
    board.style.setProperty('--n', n);
    board.classList.toggle('picture', !!puzzle.picture);
    board.classList.remove('solved');
    tray.innerHTML = '';
    tileEls = {};
    // In picture levels the gap's piece of the picture waits hidden and fades in once solved
    const tiles = puzzle.picture ? [...cells] : cells.filter(t => t);
    tiles.forEach(tile => {
        const el = document.createElement('div');
        el.className = tile ? 'tile' : 'tile missing';
        el.dataset.tile = tile;
        if (puzzle.picture) el.style.cssText = pictureStyle(tile);
        el.innerHTML = tile ? `<span class="${puzzle.picture ? 'badge' : 'num'}">${tile}</span>` : '';
        tray.appendChild(el);
        tileEls[tile] = el;
    });
    Object.values(tileEls).forEach(el => { el.style.transition = 'none'; });
    cells.forEach((tile, i) => placeTile(tile, i));
    if (tileEls[0]) placeTile(0, puzzle.target.indexOf(0));
    void tray.offsetWidth;
    Object.values(tileEls).forEach(el => { el.style.transition = ''; });
}

function placeTile(tile, i) {
    const el = tileEls[tile];
    if (!el) return;
    const n = puzzle.n;
    el.style.transform = `translate(${(i % n) * 100}%, ${Math.floor(i / n) * 100}%)`;
    if (tile) el.classList.toggle('home', puzzle.target[i] === tile);
}

function buildPreview() {
    const n = puzzle.n;
    if (puzzle.picture) {
        const gap = puzzle.target.indexOf(0);
        preview.innerHTML = `<div class="mini-pic" style="background-image:url(${Pictures.url(puzzle.picture)})">` +
            `<i style="left:${(gap % n) * 100 / n}%;top:${Math.floor(gap / n) * 100 / n}%;width:${100 / n}%;height:${100 / n}%"></i></div>`;
    } else {
        preview.innerHTML = `<div class="mini" style="grid-template-columns:repeat(${n}, 1fr)">` +
            puzzle.target.map(t => `<i class="${t ? '' : 'gap'}">${t || ''}</i>`).join('') + '</div>';
    }
}

/* ---------- Counters & status ---------- */

function renderCounters() {
    countersEl.innerHTML = [`${i18n.t('moves')}: ${moves}`, `${i18n.t('par')}: ${puzzle.par}`]
        .map(text => `<span>${text}</span>`).join('');
    undoBtn.disabled = !history.length || solved;
}

function setStatus(key) {
    statusKey = key;
    statusEl.innerText = i18n.t(key, { n: moves });
    statusEl.classList.toggle('win', key !== 'status_play');
}

function updateLevelInfo() {
    const level = LevelRegistry[currentLevelIdx];
    levelInfoEl.innerText = `${i18n.t('level')} ${currentLevelIdx + 1}/${LevelRegistry.length}: ${level.name}`;
}

/* ---------- Moves ---------- */

function slide(run) {
    if (!run || solved) return false;
    FifteenEngine.apply(cells, run);
    run.forEach(m => placeTile(m.tile, m.to));
    history.push(run);
    moves += run.length;
    renderCounters();
    if (FifteenEngine.isSolved(cells, puzzle.target)) win();
    return true;
}

function tapCell(i) {
    slide(FifteenEngine.runTo(cells, puzzle.n, i));
}

function moveDirection(dir) {
    const i = FifteenEngine.cellForDirection(cells, puzzle.n, dir);
    if (i >= 0) tapCell(i);
}

function undo() {
    if (solved || !history.length) return;
    const run = history.pop();
    FifteenEngine.revert(cells, run);
    run.forEach(m => placeTile(m.tile, m.from));
    moves -= run.length;
    renderCounters();
}

function win() {
    solved = true;
    board.classList.add('solved');
    setStatus(moves <= puzzle.par ? 'status_perfect' : 'status_solved');
    Progress.markSolved(currentLevelIdx);
    renderCounters();
    const level = currentLevelIdx;
    setTimeout(() => { if (level === currentLevelIdx && solved) nextLevel(); }, SOLVED_DELAY);
}

function nextLevel() {
    if (currentLevelIdx + 1 < LevelRegistry.length) loadLevel(currentLevelIdx + 1);
    else setStatus('all_levels_cleared');
}

/* ---------- Input ---------- */

tray.addEventListener('click', (event) => {
    const el = event.target.closest('.tile');
    if (!el || el.classList.contains('missing')) return;
    tapCell(cells.indexOf(Number(el.dataset.tile)));
});

undoBtn.onclick = () => undo();
document.getElementById('restartBtn').onclick = () => loadLevel(currentLevelIdx);

const KEY_DIRS = { arrowup: 'up', w: 'up', arrowdown: 'down', s: 'down', arrowleft: 'left', a: 'left', arrowright: 'right', d: 'right' };

document.addEventListener('keydown', (event) => {
    const inFormControl = event.target instanceof Element && event.target.closest('select, input');
    if (inFormControl || document.querySelector('.modal.active') || !puzzle) return;
    const key = event.key.toLowerCase();
    if (KEY_DIRS[key]) moveDirection(KEY_DIRS[key]);
    else if (key === 'z' || key === 'backspace') undo();
    else return;
    event.preventDefault();
});

// A swipe moves the tile next to the gap in the swipe's direction
let touchStart = null;
board.addEventListener('touchstart', (e) => { touchStart = e.touches[0]; }, { passive: true });
board.addEventListener('touchend', (e) => {
    if (!touchStart) return;
    const dx = e.changedTouches[0].clientX - touchStart.clientX;
    const dy = e.changedTouches[0].clientY - touchStart.clientY;
    touchStart = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_MIN) return;
    e.preventDefault();
    if (Math.abs(dx) > Math.abs(dy)) moveDirection(dx > 0 ? 'right' : 'left');
    else moveDirection(dy > 0 ? 'down' : 'up');
});

window.addEventListener('langChanged', () => {
    setStatus(statusKey);
    updateLevelInfo();
    renderCounters();
});

if (LevelRegistry.length > 0) loadLevel(Progress.startLevel());
