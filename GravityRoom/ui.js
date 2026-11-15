/**
 * Gravity Room page: the room element turns on screen (CSS transition), and
 * once it has turned the blocks slide towards the new floor. Blocks keep their
 * DOM elements between renders so their moves animate.
 */
const TURN_MS = 380;
const FALL_MS = 260;
const SWIPE_MIN = 30;
const SYMBOLS = { r: '●', g: '▲', b: '■', y: '◆', o: '' };

let currentLevelIdx = 0;
let state = null;
let history = [];
let busy = false;
let solved = false;
let statusKey = 'status_play';
let cell = 40;

const stage = document.getElementById('stage');
const preview = document.getElementById('goal-preview');
const statusEl = document.getElementById('status');
const levelInfoEl = document.getElementById('level-info');
const countersEl = document.getElementById('counters');

function loadLevel(idx) {
    const level = LevelRegistry[idx];
    if (!level) return;
    currentLevelIdx = idx;
    Progress.setCurrent(idx);
    state = GravityEngine.parse(level);
    history = [];
    busy = false;
    solved = false;
    setStatus('status_play');
    updateLevelInfo();
    buildPreview();
    buildRoom();
    render();
}

/* ---------- Building the room ---------- */

function cellSize() {
    const span = Math.max(state.width, state.height);
    const room = Math.min(340, document.getElementById('app').clientWidth - 64);
    return Math.floor(room / span);
}

// Static parts (floor, walls, goals) once per level; blocks are added by render()
function buildRoom() {
    cell = cellSize();
    const span = Math.max(state.width, state.height) * cell;
    stage.style.width = stage.style.height = `${span + 24}px`;
    stage.style.setProperty('--cell', `${cell}px`);

    const tiles = [];
    for (let y = 0; y < state.height; y++) {
        for (let x = 0; x < state.width; x++) {
            const wall = state.walls.has(`${x},${y}`);
            const goal = state.goal.find(g => g.x === x && g.y === y);
            const cls = wall ? 'wall' : goal ? `goal c-${goal.c}` : '';
            tiles.push(`<div class="tile ${cls}" style="left:${x * cell}px; top:${y * cell}px">${goal ? `<span>${SYMBOLS[goal.c]}</span>` : ''}</div>`);
        }
    }
    stage.innerHTML = `<div id="room" class="room" style="width:${state.width * cell}px; height:${state.height * cell}px">${tiles.join('')}</div>`;
    setAngle(false);
}

function buildPreview() {
    const size = Math.max(6, Math.floor(84 / Math.max(state.width, state.height)));
    const tiles = [];
    for (let y = 0; y < state.height; y++) {
        for (let x = 0; x < state.width; x++) {
            const wall = state.walls.has(`${x},${y}`);
            const goal = state.goal.find(g => g.x === x && g.y === y);
            tiles.push(`<i class="${wall ? 'wall' : goal ? `c-${goal.c}` : ''}"></i>`);
        }
    }
    preview.innerHTML = `<div class="mini" style="grid-template-columns: repeat(${state.width}, ${size}px); grid-auto-rows: ${size}px">${tiles.join('')}</div>`;
}

function setAngle(animate = true) {
    const room = document.getElementById('room');
    room.style.transition = animate ? `transform ${TURN_MS}ms ease-in-out` : 'none';
    room.style.transform = `rotate(${state.turns * 90}deg)`;
    preview.firstElementChild.style.transform = `rotate(${state.turns * 90}deg)`;
}

/* ---------- Rendering blocks ---------- */

function render() {
    const room = document.getElementById('room');
    state.blocks.forEach(block => {
        let el = room.querySelector(`[data-block="${block.id}"]`);
        if (!el) {
            el = document.createElement('div');
            el.className = `block c-${block.c}`;
            el.dataset.block = block.id;
            el.innerHTML = `<span>${SYMBOLS[block.c]}</span>`;
            room.appendChild(el);
        }
        el.style.transform = `translate(${block.x * cell}px, ${block.y * cell}px)`;
        el.classList.toggle('home', GravityEngine.isOnGoal(state, block));
    });
    const onGoal = state.blocks.filter(b => GravityEngine.isOnGoal(state, b)).length;
    countersEl.innerHTML = [`${i18n.t('turns')}: ${state.moves}`, `${i18n.t('par')}: ${state.par}`, `${i18n.t('placed')}: ${onGoal}/${state.goal.length}`]
        .map(text => `<span>${text}</span>`).join('');
    document.getElementById('undoBtn').disabled = !history.length || busy || solved;
}

/* ---------- Turning ---------- */

function turn(dir) {
    if (!state || busy || solved) return;
    busy = true;
    history.push(GravityEngine.snapshot(state));
    GravityEngine.turn(state, dir);
    setAngle(true);
    render();
    const level = currentLevelIdx;
    setTimeout(() => {
        if (level !== currentLevelIdx) return;
        const moved = GravityEngine.settle(state);
        render();
        setTimeout(() => {
            if (level !== currentLevelIdx) return;
            busy = false;
            afterTurn();
        }, moved ? FALL_MS : 0);
    }, TURN_MS);
}

function afterTurn() {
    render();
    if (!GravityEngine.isSolved(state)) {
        if (statusKey !== 'status_play') setStatus('status_play');
        return;
    }
    solved = true;
    setStatus(state.moves <= state.par ? 'status_perfect' : 'status_solved');
    Progress.markSolved(currentLevelIdx);
    render();
    const level = currentLevelIdx;
    setTimeout(() => { if (level === currentLevelIdx) nextLevel(); }, 2000);
}

function undo() {
    if (busy || solved || !history.length) return;
    GravityEngine.restore(state, history.pop());
    setAngle(true);
    render();
    setStatus('status_play');
}

function nextLevel() {
    if (currentLevelIdx + 1 < LevelRegistry.length) loadLevel(currentLevelIdx + 1);
    else setStatus('all_levels_cleared');
}

/* ---------- Status ---------- */

function setStatus(key) {
    statusKey = key;
    statusEl.innerText = i18n.t(key, { n: state ? state.moves : 0 });
}

function updateLevelInfo() {
    const level = LevelRegistry[currentLevelIdx];
    levelInfoEl.innerText = `${i18n.t('level')} ${currentLevelIdx + 1}/${LevelRegistry.length}: ${level.name}`;
}

/* ---------- Input ---------- */

document.getElementById('ccwBtn').onclick = () => turn(-1);
document.getElementById('cwBtn').onclick = () => turn(1);
document.getElementById('undoBtn').onclick = () => undo();
document.getElementById('restartBtn').onclick = () => loadLevel(currentLevelIdx);

document.addEventListener('keydown', (event) => {
    const inFormControl = event.target instanceof Element && event.target.closest('select, input');
    if (inFormControl || document.querySelector('.modal.active')) return;
    const key = event.key.toLowerCase();
    if (['arrowleft', 'a', 'q'].includes(key)) turn(-1);
    else if (['arrowright', 'd', 'e'].includes(key)) turn(1);
    else if (key === 'z' || key === 'backspace') undo();
    else return;
    event.preventDefault();
});

// Swipe right turns clockwise, swipe left counter-clockwise
let touchStart = null;
stage.addEventListener('touchstart', (e) => { touchStart = e.touches[0]; }, { passive: true });
stage.addEventListener('touchend', (e) => {
    if (!touchStart) return;
    const dx = e.changedTouches[0].clientX - touchStart.clientX;
    const dy = e.changedTouches[0].clientY - touchStart.clientY;
    touchStart = null;
    if (Math.abs(dx) >= SWIPE_MIN && Math.abs(dx) > Math.abs(dy)) turn(dx > 0 ? 1 : -1);
});

window.addEventListener('resize', () => {
    if (!state || busy || cellSize() === cell) return;
    buildRoom();
    render();
});

window.addEventListener('langChanged', () => {
    setStatus(statusKey);
    updateLevelInfo();
    render();
});

if (LevelRegistry.length > 0) loadLevel(Progress.startLevel());
