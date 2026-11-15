const SWIPE_MIN = 24; // px a finger must travel on the board to count as a swipe
const ARROWS = { up: '↑', down: '↓', left: '←', right: '→', wait: '·' };

let currentLevelIdx = 0;
let puzzle = null;
let echoes = [];       // action lists of the earlier runs, oldest first
let actions = [];      // actions of the current run
let world = null;      // TimeLoopEngine.simulate result for the current moment
let isSolved = false;
let paradoxEcho = null; // echo highlighted after a refused action
let statusKey = 'status_play';
let statusParams = {};

const board = document.getElementById('game-board');
const statusEl = document.getElementById('status');
const levelInfoEl = document.getElementById('level-info');
const countersEl = document.getElementById('counters');
const timelineEl = document.getElementById('timeline');
const undoBtn = document.getElementById('undoBtn');
const rewindBtn = document.getElementById('rewindBtn');

function loadLevel(idx) {
    const level = LevelRegistry[idx];
    if (!level) return;

    currentLevelIdx = idx;
    Progress.setCurrent(idx);
    puzzle = TimeLoopEngine.parse(level);
    echoes = [];
    actions = [];
    isSolved = false;
    paradoxEcho = null;
    world = TimeLoopEngine.simulate(puzzle, echoes, actions);
    setStatus('status_play', { n: 1 });
    updateLevelInfo();
    render();
}

/* ---------- Actions ---------- */

window.act = (action) => {
    if (isSolved) return;
    const result = TimeLoopEngine.simulate(puzzle, echoes, [...actions, action]);
    if (result.error === 'blocked') {
        paradoxEcho = null;
        if (result.reason === 'door') setStatus('status_door_closed');
        if (result.reason === 'occupied') setStatus('status_blocked_echo');
        render();
        return;
    }
    if (result.error === 'paradox') {
        paradoxEcho = result.echo;
        setStatus('status_paradox', { n: result.echo + 1 });
        render();
        return;
    }
    actions.push(action);
    world = result;
    paradoxEcho = null;
    if (world.won) {
        solve();
    } else {
        setStatus('status_play', { n: echoes.length + 1 });
    }
    render();
};

window.rewind = () => {
    if (isSolved) return;
    if (actions.length === 0) { setStatus('status_rewind_empty'); return; }
    if (echoes.length >= puzzle.maxEchoes) { setStatus('status_no_echoes', { n: puzzle.maxEchoes }); return; }
    echoes.push(actions);
    actions = [];
    paradoxEcho = null;
    world = TimeLoopEngine.simulate(puzzle, echoes, actions);
    setStatus('status_rewound', { n: echoes.length });
    render();
};

// Takes back the last action; at time 0 it undoes the last rewind instead
window.undo = () => {
    if (isSolved) return;
    if (actions.length) {
        actions.pop();
    } else if (echoes.length) {
        actions = echoes.pop();
    } else {
        return;
    }
    paradoxEcho = null;
    world = TimeLoopEngine.simulate(puzzle, echoes, actions);
    setStatus('status_play', { n: echoes.length + 1 });
    render();
};

function solve() {
    isSolved = true;
    setStatus('status_solved', { t: world.time, n: echoes.length });
    Progress.markSolved(currentLevelIdx);
    const solvedLevelIdx = currentLevelIdx;
    setTimeout(() => {
        if (solvedLevelIdx === currentLevelIdx) nextLevel();
    }, 2000);
}

function nextLevel() {
    if (currentLevelIdx + 1 < LevelRegistry.length) {
        loadLevel(currentLevelIdx + 1);
    } else {
        setStatus('all_levels_cleared');
    }
}

/* ---------- Rendering ---------- */

function render() {
    board.style.gridTemplateColumns = `repeat(${puzzle.width}, 1fr)`;
    board.style.maxWidth = `${puzzle.width * 56}px`;
    const open = TimeLoopEngine.openDoors(puzzle, world);

    const cells = [];
    for (let r = 0; r < puzzle.height; r++) {
        for (let c = 0; c < puzzle.width; c++) cells.push(renderCell(r, c, open));
    }
    board.innerHTML = cells.join('');

    countersEl.innerText = `${i18n.t('time')}: ${world.time}  ·  ${i18n.t('echoes')}: ${echoes.length}/${puzzle.maxEchoes}`;
    undoBtn.disabled = isSolved || (actions.length === 0 && echoes.length === 0);
    rewindBtn.disabled = isSolved || echoes.length >= puzzle.maxEchoes;
    renderTimeline();
}

function renderCell(r, c, open) {
    const ch = puzzle.tiles[r][c];
    if (ch === '#') return `<div class="cell ${touchesFloor(r, c) ? 'wall' : 'void'}"></div>`;

    const classes = ['cell', 'floor'];
    let label = '';
    if (/[a-z]/.test(ch)) {
        classes.push('plate', `key-${ch}`);
        if (TimeLoopEngine.occupied(world.entities, r, c)) classes.push('pressed');
    } else if (TimeLoopEngine.isDoor(ch)) {
        classes.push('door', `key-${ch.toLowerCase()}`, open.includes(ch) ? 'open' : 'closed');
        label = `<span class="door-label">${ch}</span>`;
    } else if (ch === 'X') {
        classes.push('exit');
    } else if (ch === '@') {
        classes.push('start');
    }

    const here = ([pr, pc]) => pr === r && pc === c;
    const echoMarks = world.echoes
        .filter(e => e.present && here(e.pos))
        .map(e => `<span class="echo ${e.idx === paradoxEcho ? 'paradox' : ''}" title="${i18n.t('echo')} ${e.idx + 1}">${e.idx + 1}<small>${ARROWS[e.next] || ''}</small></span>`)
        .join('');
    const player = here(world.player) ? `<span class="player ${isSolved ? 'solved' : ''}"></span>` : '';
    return `<div class="${classes.join(' ')}">${label}${echoMarks}${player}</div>`;
}

function touchesFloor(r, c) {
    for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
            const ch = puzzle.tiles[r + dr]?.[c + dc];
            if (ch && ch !== '#') return true;
        }
    }
    return false;
}

// One bar per run; the line marks the present moment
function renderTimeline() {
    const span = Math.max(12, world.time + 4, ...echoes.map(e => e.length));
    const pct = n => `${(n / span) * 100}%`;
    const rows = echoes.map((list, idx) => `
        <div class="tl-row ${idx === paradoxEcho ? 'paradox' : ''}">
            <span class="tl-label">${i18n.t('echo')} ${idx + 1}</span>
            <span class="tl-track"><span class="tl-bar echo-bar" style="width:${pct(list.length)}"></span><span class="tl-now" style="left:${pct(world.time)}"></span></span>
        </div>`);
    rows.push(`
        <div class="tl-row">
            <span class="tl-label">${i18n.t('you')}</span>
            <span class="tl-track"><span class="tl-bar you-bar" style="width:${pct(world.time)}"></span><span class="tl-now" style="left:${pct(world.time)}"></span></span>
        </div>`);
    timelineEl.innerHTML = rows.join('');
}

/* ---------- Text ---------- */

function setStatus(key, params = {}) {
    statusKey = key;
    statusParams = params;
    statusEl.innerText = i18n.t(key, params);
    statusEl.classList.toggle('warn', key === 'status_paradox');
}

function updateLevelInfo() {
    const level = LevelRegistry[currentLevelIdx];
    levelInfoEl.innerText = `${i18n.t('level')} ${currentLevelIdx + 1}/${LevelRegistry.length}: ${level.name}`;
}

/* ---------- Input ---------- */

document.addEventListener('keydown', (event) => {
    const inFormControl = event.target instanceof Element && event.target.closest('select, input');
    if (inFormControl || document.querySelector('.modal.active')) return;
    const keys = {
        ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
        w: 'up', s: 'down', a: 'left', d: 'right', ' ': 'wait', '.': 'wait'
    };
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    if (keys[key]) {
        act(keys[key]);
    } else if (key === 't') {
        rewind();
    } else if (key === 'z' || key === 'Backspace') {
        undo();
    } else if (key === 'r') {
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
        act(dx > 0 ? 'right' : 'left');
    } else {
        act(dy > 0 ? 'down' : 'up');
    }
});

document.getElementById('restartBtn').onclick = () => loadLevel(currentLevelIdx);

window.addEventListener('langChanged', () => {
    setStatus(statusKey, statusParams);
    updateLevelInfo();
    render();
});

// Initial Load
if (LevelRegistry.length > 0) loadLevel(Progress.startLevel());
