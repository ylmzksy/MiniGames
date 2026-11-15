const SWIPE_MIN = 24; // px a finger must travel on the board to count as a swipe
const BEAM_MS = 350;   // how long a fired beam stays visible

let currentLevelIdx = 0;
let puzzle = null;
let state = null;      // { player: [r, c], crystals: [[r, c], ...] }
let history = [];      // previous { state, moves, blinks }, for undo
let moves = 0;
let blinks = 0;
let blinkMode = false; // the next direction fires the beam instead of walking
let beamCells = null;  // cells of the last beam, shown for a moment
let beamTimer = null;
let isSolved = false;
let statusKey = 'status_play';

const board = document.getElementById('game-board');
const statusEl = document.getElementById('status');
const levelInfoEl = document.getElementById('level-info');
const countersEl = document.getElementById('counters');
const undoBtn = document.getElementById('undoBtn');
const blinkBtn = document.getElementById('blinkBtn');

function loadLevel(idx) {
    const level = LevelRegistry[idx];
    if (!level) return;

    currentLevelIdx = idx;
    Progress.setCurrent(idx);
    puzzle = BlinkEngine.parse(level);
    state = puzzle.state;
    history = [];
    moves = 0;
    blinks = 0;
    blinkMode = false;
    beamCells = null;
    isSolved = false;
    setStatus('status_play');
    updateLevelInfo();
    render();
}

/* ---------- Actions ---------- */

window.movePlayer = (dir) => {
    if (isSolved) return;
    if (blinkMode) { fireBlink(dir); return; }
    const result = BlinkEngine.move(puzzle, state, dir);
    if (result.blocked) {
        if (result.blocked === 'door') setStatus('status_door_closed');
        if (result.blocked === 'chasm') setStatus('status_chasm');
        return;
    }
    commit(result.state, 'move');
    setStatus(result.teleported ? 'status_portal' : 'status_play');
    render();
    checkSolved();
};

function fireBlink(dir) {
    blinkMode = false;
    const result = BlinkEngine.blink(puzzle, state, dir);
    showBeam(result.beam);
    if (result.blocked) {
        setStatus('status_blink_miss');
        render();
        return;
    }
    commit(result.state, 'blink');
    setStatus('status_blinked');
    render();
    checkSolved();
}

function commit(next, kind) {
    history.push({ state, moves, blinks });
    state = next;
    moves++;
    if (kind === 'blink') blinks++;
}

window.toggleBlink = () => {
    if (isSolved) return;
    blinkMode = !blinkMode;
    setStatus(blinkMode ? 'status_aim' : 'status_play');
    render();
};

window.undo = () => {
    if (!history.length || isSolved) return;
    ({ state, moves, blinks } = history.pop());
    blinkMode = false;
    beamCells = null;
    setStatus('status_play');
    render();
};

function showBeam(beam) {
    beamCells = new Set(beam.segments.flat().map(p => p.join(',')));
    clearTimeout(beamTimer);
    beamTimer = setTimeout(() => { beamCells = null; render(); }, BEAM_MS);
}

function checkSolved() {
    if (!BlinkEngine.isSolved(puzzle, state)) return;
    isSolved = true;
    blinkMode = false;
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

/* ---------- Rendering ---------- */

// Crystals the beam would hit, keyed "r,c" -> direction, shown while aiming
function blinkTargets() {
    const targets = new Map();
    Object.keys(BlinkEngine.directions).forEach(dir => {
        const { hit } = BlinkEngine.trace(puzzle, state, dir);
        if (hit >= 0) targets.set(state.crystals[hit].join(','), dir);
    });
    return targets;
}

function render() {
    board.style.gridTemplateColumns = `repeat(${puzzle.width}, 1fr)`;
    board.style.maxWidth = `${puzzle.width * 56}px`;
    board.classList.toggle('aiming', blinkMode);
    const targets = blinkMode ? blinkTargets() : new Map();

    const cells = [];
    for (let r = 0; r < puzzle.height; r++) {
        for (let c = 0; c < puzzle.width; c++) cells.push(renderCell(r, c, targets));
    }
    board.innerHTML = cells.join('');

    countersEl.innerText = `${i18n.t('moves')}: ${moves}  ·  ${i18n.t('blinks')}: ${blinks}`;
    undoBtn.disabled = history.length === 0 || isSolved;
    blinkBtn.classList.toggle('active', blinkMode);
    blinkBtn.disabled = isSolved;
}

function renderCell(r, c, targets) {
    const ch = puzzle.tiles[r][c];
    const data = `data-r="${r}" data-c="${c}"`;
    if (ch === '#') return `<div class="cell ${touchesFloor(r, c) ? 'wall' : 'void'}" ${data}></div>`;

    const classes = ['cell'];
    let content = '';
    if (ch === '~') {
        classes.push('chasm');
    } else {
        classes.push('floor');
        if (/[a-z]/.test(ch)) {
            classes.push('plate', `key-${ch}`);
            if (BlinkEngine.pressed(state, r, c)) classes.push('pressed');
        } else if (BlinkEngine.isDoor(ch)) {
            classes.push('door', `key-${ch.toLowerCase()}`, BlinkEngine.doorOpen(puzzle, state, ch) ? 'open' : 'closed');
            content += `<span class="door-label">${ch}</span>`;
        } else if (/[1-9]/.test(ch)) {
            classes.push('pad', `pad-${ch}`);
            content += `<span class="pad-label">${ch}</span>`;
        } else if (ch === 'X') {
            classes.push('exit');
        }
    }

    const key = `${r},${c}`;
    if (beamCells?.has(key)) classes.push('beam');
    if (BlinkEngine.crystalAt(state, r, c) >= 0) {
        content += `<span class="crystal ${targets.has(key) ? 'target' : ''}"></span>`;
    }
    if (state.player[0] === r && state.player[1] === c) {
        content += `<span class="player ${isSolved ? 'solved' : ''}"></span>`;
    }
    return `<div class="${classes.join(' ')}" ${data}>${content}</div>`;
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

/* ---------- Text ---------- */

function setStatus(key) {
    statusKey = key;
    statusEl.innerText = i18n.t(key, { moves, blinks });
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
        w: 'up', s: 'down', a: 'left', d: 'right'
    };
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    if (keys[key]) {
        // Shift + direction fires the beam right away
        if (event.shiftKey && !isSolved) fireBlink(keys[key]);
        else movePlayer(keys[key]);
    } else if (key === ' ' || key === 'b') {
        toggleBlink();
    } else if (key === 'Escape' && blinkMode) {
        toggleBlink();
    } else if (key === 'z' || key === 'Backspace') {
        undo();
    } else if (key === 'r') {
        loadLevel(currentLevelIdx);
    } else {
        return;
    }
    event.preventDefault();
});

// Tapping a neighboring cell walks there; tapping a crystal in the beam's reach blinks to it
board.addEventListener('click', (event) => {
    const cell = event.target.closest('.cell');
    if (!cell || isSolved) return;
    const r = Number(cell.dataset.r);
    const c = Number(cell.dataset.c);
    const target = blinkTargets().get(`${r},${c}`);
    if (target) { fireBlink(target); return; }
    const dr = r - state.player[0];
    const dc = c - state.player[1];
    if (Math.abs(dr) + Math.abs(dc) !== 1) return;
    blinkMode = false;
    movePlayer(dr ? (dr > 0 ? 'down' : 'up') : (dc > 0 ? 'right' : 'left'));
});

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
    event.preventDefault(); // a swipe is not a tap
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
