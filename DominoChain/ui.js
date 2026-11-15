let currentLevelIdx = 0;
let state = null;
let history = [];      // previous states, for undo
let selected = null;   // index of the selected tray tile
let isSolved = false;
let statusKey = 'status_play';

const board = document.getElementById('game-board');
const trayEl = document.getElementById('player-hand');
const statusEl = document.getElementById('status');
const levelInfoEl = document.getElementById('level-info');
const countersEl = document.getElementById('counters');
const undoBtn = document.getElementById('undoBtn');

function loadLevel(idx) {
    const level = LevelRegistry[idx];
    if (!level) return;

    currentLevelIdx = idx;
    Progress.setCurrent(idx);
    state = ChainEngine.create(level);
    history = [];
    selected = null;
    isSolved = false;
    setStatus(state.ring ? 'status_play_ring' : 'status_play');
    updateLevelInfo();
    render();
}

function selectTile(idx) {
    if (isSolved) return;
    const moves = ChainEngine.placements(state, idx);
    if (!moves.length) {
        selected = null;
        setStatus('status_no_fit');
        render();
        return;
    }
    if (moves.length === 1) {
        play(idx, moves[0]);
        return;
    }
    selected = selected === idx ? null : idx;
    setStatus(selected === null ? 'status_play' : 'status_pick_end');
    render();
}

// With matching halves a tile has at most one way to sit at each end
function playAt(end) {
    if (selected === null) return;
    const move = ChainEngine.placements(state, selected).find(m => m.end === end);
    if (move) play(selected, move);
}

function play(idx, move) {
    history.push(state);
    state = ChainEngine.play(state, idx, move);
    selected = null;
    if (ChainEngine.isSolved(state)) {
        solve();
    } else if (ChainEngine.isStuck(state)) {
        setStatus(state.tray.length ? 'status_stuck' : 'status_ring_open');
    } else {
        setStatus('status_play');
    }
    render();
}

window.undo = () => {
    if (!history.length || isSolved) return;
    state = history.pop();
    selected = null;
    setStatus('status_play');
    render();
};

function solve() {
    isSolved = true;
    setStatus('status_solved');
    Progress.markSolved(currentLevelIdx);
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

function render() {
    const ghosts = {};
    if (selected !== null) {
        const tile = state.tray[selected];
        ChainEngine.placements(state, selected).forEach(({ end, outer }) => {
            const inner = outer === tile[0] ? tile[1] : tile[0];
            const shown = end === 'left' ? [outer, inner] : [inner, outer];
            ghosts[end] = DominoView.tile(shown, { horizontal: !Dominoes.isDouble(tile), cls: 'ghost', attrs: `data-end="${end}"` });
        });
    }
    board.innerHTML = DominoView.line(state.line, ghosts);
    board.classList.toggle('solved', isSolved);

    trayEl.innerHTML = state.tray.map((t, idx) => {
        const fits = ChainEngine.placements(state, idx).length > 0;
        const classes = [fits ? 'playable' : 'dim', selected === idx ? 'selected' : ''];
        return DominoView.tile(t, { cls: classes.join(' '), attrs: `data-idx="${idx}"` });
    }).join('');

    const ends = Dominoes.ends(state.line);
    countersEl.innerText = `${i18n.t('tiles_left')}: ${state.tray.length}  ·  ${i18n.t('ends')}: ${ends.left} | ${ends.right}`;
    undoBtn.disabled = history.length === 0 || isSolved;
}

function setStatus(key) {
    statusKey = key;
    statusEl.innerText = i18n.t(key);
}

function updateLevelInfo() {
    const level = LevelRegistry[currentLevelIdx];
    const ring = level.ring ? ` (${i18n.t('ring')})` : '';
    levelInfoEl.innerText = `${i18n.t('level')} ${currentLevelIdx + 1}/${LevelRegistry.length}: ${level.name}${ring}`;
}

trayEl.addEventListener('click', (event) => {
    const tile = event.target.closest('.domino');
    if (tile) selectTile(Number(tile.dataset.idx));
});

board.addEventListener('click', (event) => {
    const ghost = event.target.closest('[data-end]');
    if (ghost) playAt(ghost.dataset.end);
});

document.addEventListener('keydown', (event) => {
    if (document.querySelector('.modal.active')) return;
    const key = event.key.toLowerCase();
    if (key === 'z' || event.key === 'Backspace') undo();
    else if (key === 'r') loadLevel(currentLevelIdx);
    else return;
    event.preventDefault();
});

document.getElementById('restartBtn').onclick = () => loadLevel(currentLevelIdx);

window.addEventListener('langChanged', () => {
    setStatus(statusKey);
    updateLevelInfo();
    render();
});

// Initial Load
if (LevelRegistry.length > 0) loadLevel(Progress.startLevel());
