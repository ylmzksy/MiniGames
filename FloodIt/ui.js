const FLOOD_COLORS = ['#e03b3b', '#3b6fe0', '#1f9d55', '#f5b301', '#9b4ddb', '#17b8c8'];

let currentLevelIdx = 0;
let state = null;
let isOver = false;
let statusKey = 'status_play';

const board = document.getElementById('game-board');
const palette = document.getElementById('palette');
const statusEl = document.getElementById('status');
const levelInfoEl = document.getElementById('level-info');
const countersEl = document.getElementById('counters');

function loadLevel(idx) {
    const level = LevelRegistry[idx];
    if (!level) return;

    currentLevelIdx = idx;
    Progress.setCurrent(idx);
    state = FloodEngine.create(level);
    isOver = false;
    setStatus('status_play');
    updateLevelInfo();
    renderPalette();
    render();
}

function renderPalette() {
    palette.innerHTML = FLOOD_COLORS.slice(0, state.colors).map((color, i) =>
        `<button class="swatch" style="--swatch:${color}" onclick="pickColor(${i})" title="${i + 1}"></button>`).join('');
}

function render() {
    board.style.gridTemplateColumns = `repeat(${state.size}, 1fr)`;
    const region = FloodEngine.region(state.board);
    const cells = [];
    for (let r = 0; r < state.size; r++) {
        for (let c = 0; c < state.size; c++) {
            cells.push(`<div class="cell ${region.has(`${r},${c}`) ? 'flooded' : ''}" style="background:${FLOOD_COLORS[state.board[r][c]]}" onclick="pickColor(${state.board[r][c]})"></div>`);
        }
    }
    board.innerHTML = cells.join('');
    countersEl.innerText = `${i18n.t('moves')}: ${state.moves}/${state.limit} · ${i18n.t('flooded')}: ${Math.round((region.size / (state.size * state.size)) * 100)}%`;
}

window.pickColor = (color) => {
    if (isOver || color >= state.colors) return;
    if (!FloodEngine.flood(state, color)) return;
    render();
    if (FloodEngine.isSolved(state.board)) {
        isOver = true;
        setStatus('status_solved');
        Progress.markSolved(currentLevelIdx);
        const solvedLevelIdx = currentLevelIdx;
        setTimeout(() => { if (solvedLevelIdx === currentLevelIdx) nextLevel(); }, 1800);
    } else if (state.moves >= state.limit) {
        isOver = true;
        setStatus('status_failed');
    }
};

function nextLevel() {
    if (currentLevelIdx + 1 < LevelRegistry.length) loadLevel(currentLevelIdx + 1);
    else setStatus('all_levels_cleared');
}

function setStatus(key) {
    statusKey = key;
    statusEl.innerText = i18n.t(key, { moves: state.moves });
}

function updateLevelInfo() {
    const level = LevelRegistry[currentLevelIdx];
    levelInfoEl.innerText = `${i18n.t('level')} ${currentLevelIdx + 1}/${LevelRegistry.length}: ${level.name} (${level.size}×${level.size})`;
}

document.addEventListener('keydown', (event) => {
    if (document.querySelector('.modal.active')) return;
    if (/^[1-6]$/.test(event.key)) { pickColor(Number(event.key) - 1); event.preventDefault(); }
    else if (event.key.toLowerCase() === 'r') { loadLevel(currentLevelIdx); event.preventDefault(); }
});

document.getElementById('restartBtn').onclick = () => loadLevel(currentLevelIdx);

window.addEventListener('langChanged', () => {
    setStatus(statusKey);
    updateLevelInfo();
    render();
});

// Initial Load
if (LevelRegistry.length > 0) loadLevel(Progress.startLevel());
