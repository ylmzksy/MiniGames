let currentLevelIdx = 0;
let state = null;
let ticker = null;
let statusKey = 'status_play';

const board = document.getElementById('game-board');
const queueEl = document.getElementById('queue');
const statusEl = document.getElementById('status');
const levelInfoEl = document.getElementById('level-info');
const countersEl = document.getElementById('counters');

function loadLevel(idx) {
    const level = LevelRegistry[idx];
    if (!level) return;

    currentLevelIdx = idx;
    Progress.setCurrent(idx);
    state = PipeEngine.create(level);
    setStatus('status_play');
    updateLevelInfo();
    render();
    if (ticker) clearTimeout(ticker);
    schedule();
}

function schedule() {
    const level = LevelRegistry[currentLevelIdx];
    ticker = setTimeout(() => {
        const result = PipeEngine.tick(state);
        render();
        if (result === 'win') { finish(true); return; }
        if (result === 'spill') { finish(false); return; }
        schedule();
    }, state.countdown > 0 ? 1000 : level.flowMs);
}

function finish(won) {
    if (won) {
        setStatus('status_solved');
        Progress.markSolved(currentLevelIdx);
        const solvedLevelIdx = currentLevelIdx;
        setTimeout(() => {
            if (solvedLevelIdx === currentLevelIdx) nextLevel();
        }, 1800);
    } else {
        setStatus('status_spill');
    }
}

function pipeHtml(type, filled) {
    return PipeEngine.openings[type].map(d => {
        const axis = d === 'left' || d === 'right' ? 'h' : 'v';
        const isFilled = filled.includes('all') || filled.includes(axis);
        return `<i class="pipe ${d} ${isFilled ? 'filled' : ''}"></i>`;
    }).join('') + `<i class="hub ${filled.length ? 'filled' : ''}"></i>`;
}

function render() {
    board.style.gridTemplateColumns = `repeat(${state.width}, 1fr)`;
    board.style.maxWidth = `${state.width * 52}px`;
    const cells = [];
    for (let r = 0; r < state.height; r++) {
        for (let c = 0; c < state.width; c++) {
            const isSource = r === state.source[0] && c === state.source[1];
            const isDrain = state.drain && r === state.drain[0] && c === state.drain[1];
            const pipe = state.cells[r][c];
            const front = state.ooze.r === r && state.ooze.c === c;
            let inner = '';
            if (isSource) inner = `<i class="pipe ${state.sourceDir} filled"></i><span class="pump">⚙</span>`;
            else if (isDrain) inner = `<i class="pipe ${state.drain[2]} ${state.won ? 'filled' : ''}"></i><span class="drain">🕳</span>`;
            else if (pipe) inner = pipeHtml(pipe.type, pipe.filled);
            const classes = ['cell', isSource ? 'source' : '', isDrain ? 'drain-cell' : '', pipe ? 'laid' : 'empty', front && state.flowing ? 'front' : '',
                state.spilled && front ? 'spilled' : ''].join(' ');
            cells.push(`<div class="${classes}" onclick="handleTap(${r}, ${c})">${inner}</div>`);
        }
    }
    board.innerHTML = cells.join('');

    queueEl.innerHTML = state.queue.slice(0, 5).map((type, i) => `<div class="piece ${i === 0 ? 'next' : ''}">${pipeHtml(type, [])}</div>`).join('');
    countersEl.innerText = `${i18n.t('filled')}: ${state.filled}/${state.target}` + (state.countdown > 0 ? ` · ${i18n.t('countdown')}: ${state.countdown}` : '');
}

window.handleTap = (r, c) => {
    if (!state || state.won || state.spilled) return;
    if (!PipeEngine.place(state, r, c)) return;
    render();
};

window.startFlow = () => {
    if (!state || state.won || state.spilled || state.countdown === 0) return;
    state.countdown = 0;
    state.flowing = true;
    if (ticker) clearTimeout(ticker);
    render();
    schedule();
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
    statusEl.innerText = i18n.t(key, { target: state.target });
}

function updateLevelInfo() {
    const level = LevelRegistry[currentLevelIdx];
    levelInfoEl.innerText = `${i18n.t('level')} ${currentLevelIdx + 1}/${LevelRegistry.length}: ${level.name}`;
}

document.addEventListener('keydown', (event) => {
    if (document.querySelector('.modal.active')) return;
    if (event.key.toLowerCase() === 'r') loadLevel(currentLevelIdx);
    else if (event.key === ' ') { startFlow(); event.preventDefault(); }
});

document.getElementById('restartBtn').onclick = () => loadLevel(currentLevelIdx);
document.getElementById('flowBtn').onclick = () => startFlow();

window.addEventListener('langChanged', () => {
    setStatus(statusKey);
    updateLevelInfo();
    render();
});

// Initial Load
if (LevelRegistry.length > 0) loadLevel(Progress.startLevel());
