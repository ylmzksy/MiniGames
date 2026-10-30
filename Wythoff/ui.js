const PLAYER = 'blue';
const AI = 'red';

let currentLevelIdx = 0;
let game = null;
let isAiTurn = false;
let isOver = false;
let gameId = 0; // Bumped on every level load so a pending AI move from an old game is dropped
let statusKey = '';
let moves = 0;
let lastMove = null; // { from, to, owner }

const boardEl = document.getElementById('game-board');
const statusEl = document.getElementById('status');
const levelInfoEl = document.getElementById('level-info');
const countersEl = document.getElementById('counters');

function loadLevel(idx) {
    const level = LevelRegistry[idx];
    if (!level) return;

    currentLevelIdx = idx;
    Progress.setCurrent(idx);
    gameId++;
    game = WythoffEngine.create(level);
    isAiTurn = false;
    isOver = false;
    moves = 0;
    lastMove = null;
    updateLevelInfo();
    setStatus('status_your_turn');
    render();
}

function render() {
    const n = game.size;
    boardEl.style.gridTemplateColumns = `repeat(${n}, 1fr)`;
    boardEl.style.maxWidth = `${n * 46}px`;
    const legal = new Set(!isAiTurn && !isOver ? WythoffEngine.moves(game).map(m => m.join(',')) : []);
    const [qr, qc] = game.queen;

    const cells = [];
    for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
            const key = `${r},${c}`;
            const classes = ['cell', (r + c) % 2 ? 'dark' : 'light', r === 0 && c === 0 ? 'corner' : '',
                r === qr && c === qc ? 'queen' : '', legal.has(key) ? 'legal' : '',
                lastMove && lastMove.from[0] === r && lastMove.from[1] === c ? `from ${lastMove.owner}` : ''].join(' ');
            const content = r === qr && c === qc ? '♛' : r === 0 && c === 0 ? '✕' : '';
            cells.push(`<div class="${classes}" onclick="handleMove(${r}, ${c})">${content}</div>`);
        }
    }
    boardEl.innerHTML = cells.join('');
    countersEl.innerText = `${i18n.t('piles')}: ${qr} + ${qc} · ${i18n.t('moves')}: ${moves}`;
}

window.handleMove = (r, c) => {
    if (isAiTurn || isOver || !WythoffEngine.isLegal(game, [r, c])) return;
    lastMove = { from: game.queen, to: [r, c], owner: PLAYER };
    game.queen = [r, c];
    moves++;
    render();
    if (checkEnd(PLAYER)) return;

    isAiTurn = true;
    setStatus('status_ai');
    const moveGameId = gameId;
    setTimeout(() => processAiTurn(moveGameId), 500);
};

function processAiTurn(moveGameId) {
    if (moveGameId !== gameId || isOver) return;

    const difficulty = document.getElementById('difficulty').value;
    const move = difficulty === 'master' ? WythoffEngine.getMasterMove(game) : WythoffEngine.getNoviceMove(game);
    lastMove = { from: game.queen, to: move, owner: AI };
    game.queen = move;
    moves++;
    isAiTurn = false;
    render();
    if (checkEnd(AI)) return;
    setStatus('status_your_turn');
}

// Whoever moves the queen into the corner wins
function checkEnd(mover) {
    if (game.queen[0] !== 0 || game.queen[1] !== 0) return false;
    isOver = true;
    isAiTurn = false;
    render();
    if (mover === PLAYER) {
        setStatus('win');
        Progress.markSolved(currentLevelIdx);
        const winGameId = gameId;
        setTimeout(() => {
            if (winGameId === gameId) nextLevel();
        }, 2200);
    } else {
        setStatus('lose');
    }
    return true;
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
    levelInfoEl.innerText = `${i18n.t('level')} ${currentLevelIdx + 1}/${LevelRegistry.length}: ${level.name} (${level.size}×${level.size})`;
}

document.getElementById('restartBtn').onclick = () => loadLevel(currentLevelIdx);

window.addEventListener('langChanged', () => {
    setStatus(statusKey);
    updateLevelInfo();
    render();
});

// Initial Load
if (LevelRegistry.length > 0) loadLevel(Progress.startLevel());
