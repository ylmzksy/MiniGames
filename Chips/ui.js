const TICK_MS = 150;
const SWIPE_MIN = 24;
const TILE = { '#': 'wall', '.': 'floor', 'C': 'chip', 'S': 'socket', 'r': 'key red', 'g': 'key green', 'b': 'key blue', 'y': 'key yellow', 'R': 'door red', 'G': 'door green', 'B': 'door blue', 'Y': 'door yellow', '~': 'water', 'F': 'fire', 'I': 'ice', '<': 'force left', '>': 'force right', 'v': 'force down', 'A': 'force up', 'O': 'block', 'f': 'flippers', 'o': 'boots', 'X': 'exit' };
const ARROWS = { '<': '←', '>': '→', 'v': '↓', 'A': '↑' };

let currentLevelIdx = 0;
let state = null;
let ticker = null;
let heldDir = null;
let pendingDir = null;
let statusKey = 'status_play';

const board = document.getElementById('game-board');
const statusEl = document.getElementById('status');
const levelInfoEl = document.getElementById('level-info');
const countersEl = document.getElementById('counters');
const inventoryEl = document.getElementById('inventory');

function loadLevel(idx) {
    const level = LevelRegistry[idx];
    if (!level) return;

    currentLevelIdx = idx;
    Progress.setCurrent(idx);
    state = ChipsEngine.parse(level);
    heldDir = null;
    pendingDir = null;
    setStatus('status_play');
    updateLevelInfo();
    render();
    if (ticker) clearInterval(ticker);
    ticker = setInterval(tick, TICK_MS);
}

function tick() {
    if (!state || state.dead || state.won) return;
    const dir = pendingDir || heldDir;
    pendingDir = null;
    ChipsEngine.step(state, dir);
    render();
    if (state.won) {
        setStatus('status_solved');
        Progress.markSolved(currentLevelIdx);
        const solvedLevelIdx = currentLevelIdx;
        setTimeout(() => {
            if (solvedLevelIdx === currentLevelIdx) nextLevel();
        }, 1800);
    } else if (state.dead) {
        setStatus('status_dead');
    }
}

function render() {
    board.style.gridTemplateColumns = `repeat(${state.width}, 1fr)`;
    board.style.maxWidth = `${state.width * 36}px`;
    const bugs = new Set(state.bugs.map(b => `${b.r},${b.c}`));
    const cells = [];
    for (let r = 0; r < state.height; r++) {
        for (let c = 0; c < state.width; c++) {
            const ch = state.cells[r][c];
            const classes = ['cell', TILE[ch] || 'floor',
                ch === 'S' && state.chips === 0 ? 'open' : '',
                bugs.has(`${r},${c}`) ? 'bug' : '',
                state.player.r === r && state.player.c === c ? `player ${state.dead ? 'dead' : ''}` : ''].join(' ');
            cells.push(`<div class="${classes}">${ARROWS[ch] || ''}</div>`);
        }
    }
    board.innerHTML = cells.join('');
    countersEl.innerText = `${i18n.t('chips')}: ${state.chips}` + (state.chips === 0 ? ` · ${i18n.t('socket_open')}` : '');
    const items = [];
    ['r', 'g', 'b', 'y'].forEach(k => { for (let i = 0; i < state.keys[k]; i++) items.push(`<i class="item key ${{ r: 'red', g: 'green', b: 'blue', y: 'yellow' }[k]}" title="${i18n.t('key')}"></i>`); });
    if (state.flippers) items.push(`<i class="item flippers" title="${i18n.t('flippers')}"></i>`);
    if (state.boots) items.push(`<i class="item boots" title="${i18n.t('boots')}"></i>`);
    inventoryEl.innerHTML = items.length ? items.join('') : `<span class="empty">${i18n.t('no_items')}</span>`;
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
    levelInfoEl.innerText = `${i18n.t('level')} ${currentLevelIdx + 1}/${LevelRegistry.length}: ${level.name}`;
}

const KEYS = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right' };

document.addEventListener('keydown', (event) => {
    const inFormControl = event.target instanceof Element && event.target.closest('select, input');
    if (inFormControl || document.querySelector('.modal.active')) return;
    const dir = KEYS[event.key] ?? KEYS[event.key.toLowerCase()];
    if (dir) {
        if (heldDir !== dir) pendingDir = dir;
        heldDir = dir;
    } else if (event.key.toLowerCase() === 'r') {
        loadLevel(currentLevelIdx);
    } else {
        return;
    }
    event.preventDefault();
});

document.addEventListener('keyup', (event) => {
    const dir = KEYS[event.key] ?? KEYS[event.key.toLowerCase()];
    if (dir && heldDir === dir) heldDir = null;
});

document.querySelectorAll('.dpad button[data-dir]').forEach(btn => {
    const dir = btn.dataset.dir;
    btn.addEventListener('pointerdown', (event) => { event.preventDefault(); pendingDir = dir; heldDir = dir; });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(type => btn.addEventListener(type, () => { if (heldDir === dir) heldDir = null; }));
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
    pendingDir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
});

document.getElementById('restartBtn').onclick = () => loadLevel(currentLevelIdx);

window.addEventListener('langChanged', () => {
    setStatus(statusKey);
    updateLevelInfo();
    render();
});

// Initial Load
if (LevelRegistry.length > 0) loadLevel(Progress.startLevel());
